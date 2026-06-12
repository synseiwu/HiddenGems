import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function extractOutputText(data: any) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim()

  const chunks: string[] = []
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text)
      if (typeof content?.type === 'string' && content.type === 'output_text' && typeof content?.text === 'string') chunks.push(content.text)
    }
  }

  return chunks.join('\n').trim()
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, ' ').trim()
  return cleaned.length > 52 ? `${cleaned.slice(0, 52)}...` : cleaned || 'New AI Chat'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!openAiKey) return jsonResponse({ error: 'Missing OPENAI_API_KEY Supabase secret.' }, 500)
    if (!supabaseUrl) return jsonResponse({ error: 'Missing SUPABASE_URL Supabase secret.' }, 500)
    if (!serviceKey) return jsonResponse({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY Supabase secret.' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing auth header.' }, 401)

    const supabase = createClient(supabaseUrl, serviceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)

    if (userError || !userData?.user) return jsonResponse({ error: 'Unauthorized.' }, 401)

    const user = userData.user
    const body = await req.json().catch(() => ({}))
    const prompt = String(body.prompt || '').trim()
    let conversationId = body.conversationId ? String(body.conversationId) : ''

    if (!prompt) return jsonResponse({ error: 'Prompt is required.' }, 400)
    if (prompt.length > 8000) return jsonResponse({ error: 'Prompt is too long. Keep it under 8,000 characters.' }, 400)

    const { data: settingsRow } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()

    const settings = {
      enabled: settingsRow?.enabled ?? true,
      admin_free: settingsRow?.admin_free ?? true,
      model: settingsRow?.model || 'gpt-4.1-mini',
      points_per_message: Number(settingsRow?.points_per_message ?? 25),
      max_output_tokens: Number(settingsRow?.max_output_tokens ?? 900),
      system_prompt: settingsRow?.system_prompt || 'You are Hidden Gems AI Studio, a helpful assistant inside the Hidden Gems platform. Be useful, clear, and safe.'
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    if (!settings.enabled && !isAdmin) {
      return jsonResponse({ error: 'AI Studio is currently disabled.' }, 403)
    }

    const pointsCost = isAdmin && settings.admin_free ? 0 : Math.max(0, settings.points_per_message)

    if (pointsCost > 0) {
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('points_balance')
        .eq('user_id', user.id)
        .maybeSingle()

      if (walletError) return jsonResponse({ error: walletError.message }, 400)

      const balance = Number(wallet?.points_balance || 0)
      if (balance < pointsCost) {
        return jsonResponse({
          error: `Not enough points. This message costs ${pointsCost} points.`,
          points_required: pointsCost,
          points_balance: balance
        }, 402)
      }
    }

    if (conversationId) {
      const { data: existingConversation, error: conversationError } = await supabase
        .from('ai_conversations')
        .select('id,user_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (conversationError || !existingConversation) return jsonResponse({ error: 'Conversation not found.' }, 404)
      if (existingConversation.user_id !== user.id && !isAdmin) return jsonResponse({ error: 'Forbidden.' }, 403)
    } else {
      const { data: newConversation, error: newConversationError } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: titleFromPrompt(prompt)
        })
        .select('id')
        .single()

      if (newConversationError) return jsonResponse({ error: newConversationError.message }, 400)
      conversationId = newConversation.id
    }

    const { data: historyRows } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(12)

    const history = (historyRows || []).reverse().map((message: any) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').slice(0, 5000)
    }))

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.model,
        instructions: settings.system_prompt,
        input: [
          ...history,
          { role: 'user', content: prompt }
        ],
        max_output_tokens: settings.max_output_tokens,
        store: false
      })
    })

    const aiData = await openAiResponse.json().catch(() => ({}))

    if (!openAiResponse.ok) {
      const message = aiData?.error?.message || 'OpenAI request failed.'
      return jsonResponse({ error: message }, openAiResponse.status)
    }

    const answer = extractOutputText(aiData)

    if (!answer) return jsonResponse({ error: 'AI returned an empty response.' }, 400)

    let newBalance: number | null = null

    if (pointsCost > 0) {
      const { data: walletBefore } = await supabase
        .from('user_wallets')
        .select('points_balance')
        .eq('user_id', user.id)
        .maybeSingle()

      const currentBalance = Number(walletBefore?.points_balance || 0)
      if (currentBalance < pointsCost) {
        return jsonResponse({ error: 'Not enough points after refresh. Try again.', points_balance: currentBalance }, 402)
      }

      const { data: walletAfter, error: deductError } = await supabase
        .from('user_wallets')
        .update({
          points_balance: currentBalance - pointsCost,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('points_balance')
        .single()

      if (deductError) return jsonResponse({ error: deductError.message }, 400)
      newBalance = Number(walletAfter?.points_balance || 0)

      // Best-effort transaction log. Some older projects have strict transaction_type checks,
      // so this should never block the AI response if the transaction table rejects the type.
      await supabase.from('point_transactions').insert({
        user_id: user.id,
        amount: -pointsCost,
        transaction_type: 'ai_usage',
        description: `AI Studio message (${settings.model})`
      }).then(() => null).catch(() => null)
    } else {
      const { data: walletNow } = await supabase
        .from('user_wallets')
        .select('points_balance')
        .eq('user_id', user.id)
        .maybeSingle()
      newBalance = Number(walletNow?.points_balance || 0)
    }

    const { data: userMessage, error: userMessageError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: prompt,
        points_charged: 0,
        model: settings.model
      })
      .select('*')
      .single()

    if (userMessageError) return jsonResponse({ error: userMessageError.message }, 400)

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: answer,
        points_charged: pointsCost,
        model: settings.model
      })
      .select('*')
      .single()

    if (assistantMessageError) return jsonResponse({ error: assistantMessageError.message }, 400)

    await supabase
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    await supabase.from('ai_usage_logs').insert({
      user_id: user.id,
      conversation_id: conversationId,
      model: settings.model,
      points_charged: pointsCost,
      input_tokens: Number(aiData?.usage?.input_tokens || 0),
      output_tokens: Number(aiData?.usage?.output_tokens || 0)
    }).then(() => null).catch(() => null)

    return jsonResponse({
      conversation_id: conversationId,
      user_message: userMessage,
      assistant_message: assistantMessage,
      points_charged: pointsCost,
      points_balance: newBalance
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('ai-chat error:', message)
    return jsonResponse({ error: message }, 400)
  }
})
