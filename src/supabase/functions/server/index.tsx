import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Helper function to find similar Q&A from training data
const findSimilarQA = (question: string, trainingData: any[]): any[] => {
  const lowerQuestion = question.toLowerCase();
  const words = lowerQuestion.split(' ').filter(w => w.length > 3);
  
  const scored = trainingData.map(qa => {
    if (!qa || !qa.question) return { qa, score: 0 };
    
    const qaLower = qa.question.toLowerCase();
    let score = 0;
    
    // Check if any words match
    words.forEach(word => {
      if (qaLower.includes(word)) score += 1;
    });
    
    // Bonus for exact match
    if (qaLower.includes(lowerQuestion)) score += 5;
    
    return { qa, score };
  });
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.qa);
};

// Chat endpoint with RAG
app.post('/make-server-a177d153/chat', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in chat: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const { message } = await c.req.json();
    
    if (!message) {
      return c.json({ error: 'Message is required' }, 400);
    }

    console.log(`Processing chat from user ${user.id}: ${message}`);
    
    // Save user message to chat history
    const userMessageLog = {
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      role: 'user',
      text: message,
      timestamp: Date.now(),
    };
    await kv.set(`chat_history:${user.id}:${Date.now()}:user`, userMessageLog);

    // Step 1: Get training Q&A data
    const trainingQA = await kv.getByPrefix('trainingqa:');
    const validQA = trainingQA.filter(qa => qa !== null && qa !== undefined);
    console.log(`Found ${validQA.length} training Q&A entries`);

    // Step 2: Find similar Q&A
    const similarQA = findSimilarQA(message, validQA);
    console.log(`Found ${similarQA.length} similar Q&A entries`);

    // Step 3: Get documents for additional context
    const docs = await kv.getByPrefix('document:');
    const validDocs = docs.filter(doc => doc !== null && doc !== undefined);
    console.log(`Found ${validDocs.length} documents`);

    // Step 4: Build context for AI - STRICT RAG MODE
    let systemPrompt = `Kamu adalah asisten AI untuk pegawai magang di perusahaan.

ATURAN PENTING:
1. Kamu HANYA boleh menjawab berdasarkan informasi yang diberikan di bawah ini
2. JANGAN gunakan pengetahuan eksternal atau melakukan pencarian online
3. Jika informasi tidak tersedia dalam context di bawah, jawab: "Maaf, saya tidak memiliki informasi tentang hal tersebut dalam database saya. Silakan hubungi HR untuk informasi lebih lanjut."
4. Jawab dalam bahasa Indonesia dengan sopan dan profesional

`;
    
    if (similarQA.length > 0) {
      systemPrompt += '=== INFORMASI DARI TRAINING DATABASE ===\n\n';
      similarQA.forEach((qa, idx) => {
        systemPrompt += `${idx + 1}. Pertanyaan: ${qa.question}\n   Jawaban: ${qa.answer}\n\n`;
      });
    } else {
      systemPrompt += '=== INFORMASI DARI TRAINING DATABASE ===\nTidak ada informasi training yang relevan ditemukan.\n\n';
    }
    
    if (validDocs.length > 0) {
      systemPrompt += '=== DOKUMEN SOP YANG TERSEDIA ===\n';
      validDocs.forEach((doc, idx) => {
        systemPrompt += `${idx + 1}. Dokumen: ${doc.name}\n`;
        if (doc.content) {
          systemPrompt += `   Isi:\n${doc.content}\n\n`;
        }
      });
    } else {
      systemPrompt += '=== DOKUMEN SOP YANG TERSEDIA ===\nBelum ada dokumen yang diupload.\n\n';
    }
    
    systemPrompt += 'Gunakan HANYA informasi di atas untuk menjawab. Jika tidak cukup informasi, arahkan ke HR.';

    // Step 5: Call Perplexity API
    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!perplexityApiKey) {
      console.log('Error: PERPLEXITY_API_KEY not set');
      return c.json({ error: 'AI service not configured' }, 500);
    }

    console.log('Calling Perplexity API...');
    console.log('System prompt length:', systemPrompt.length);
    console.log('User message:', message);
    
    const aiResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    console.log('Perplexity API response status:', aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.log(`Perplexity API error: ${aiResponse.status} - ${errorText}`);
      return c.json({ 
        error: 'AI service error',
        details: errorText,
        status: aiResponse.status
      }, 500);
    }

    const aiData = await aiResponse.json();
    console.log('Perplexity response:', JSON.stringify(aiData).substring(0, 200));
    
    let botResponse = aiData.choices?.[0]?.message?.content || 'Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.';
    
    // Remove citation numbers [1], [2], etc. from response
    botResponse = botResponse.replace(/\[\d+\]/g, '').trim();
    
    console.log(`AI Response: ${botResponse.substring(0, 100)}...`);

    // Step 6: Save chat log
    const chatLog = {
      id: `${Date.now()}_${Math.random()}`,
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      message,
      response: botResponse,
      timestamp: Date.now(),
    };

    await kv.set(`chatlog:${chatLog.id}`, chatLog);
    console.log('Chat log saved successfully');
    
    // Save bot response to chat history
    const botMessageLog = {
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      role: 'bot',
      text: botResponse,
      timestamp: Date.now(),
      sources: similarQA.length > 0 ? `Menggunakan ${similarQA.length} referensi dari database training` : null,
    };
    await kv.set(`chat_history:${user.id}:${Date.now()}:bot`, botMessageLog);

    return c.json({ 
      response: botResponse,
      sources: similarQA.length > 0 ? `Menggunakan ${similarQA.length} referensi dari database training` : null
    });

  } catch (error) {
    console.log(`Chat error: ${error}`);
    return c.json({ 
      error: 'Internal server error while processing chat',
      details: String(error)
    }, 500);
  }
});

// Signup endpoint
app.post('/make-server-a177d153/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Signup error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Signup error: ${error}`);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Get chat logs (for HR dashboard)
app.get('/make-server-a177d153/chat-logs', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get chat logs: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const logs = await kv.getByPrefix('chatlog:');
    console.log('Raw logs from KV:', logs);
    
    // Filter out null/undefined values
    const validLogs = logs.filter(log => log !== null && log !== undefined);
    console.log('Valid logs after filtering:', validLogs);
    
    return c.json({ logs: validLogs });
  } catch (error) {
    console.log(`Get chat logs error: ${error}`);
    return c.json({ error: 'Internal server error while fetching chat logs' }, 500);
  }
});

// Get training Q&A
app.get('/make-server-a177d153/training-qa', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get training QA: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const qaList = await kv.getByPrefix('trainingqa:');
    const validQA = qaList.filter(qa => qa !== null && qa !== undefined);
    
    return c.json({ qaList: validQA });
  } catch (error) {
    console.log(`Get training QA error: ${error}`);
    return c.json({ error: 'Internal server error while fetching training data' }, 500);
  }
});

// Add training Q&A
app.post('/make-server-a177d153/training-qa', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in add training QA: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const { question, answer } = await c.req.json();
    
    if (!question || !answer) {
      return c.json({ error: 'Question and answer are required' }, 400);
    }

    const qa = {
      id: `${Date.now()}_${Math.random()}`,
      question,
      answer,
      createdAt: Date.now(),
    };

    await kv.set(`trainingqa:${qa.id}`, qa);
    
    return c.json({ qa });
  } catch (error) {
    console.log(`Add training QA error: ${error}`);
    return c.json({ error: 'Internal server error while adding training data' }, 500);
  }
});

// Delete training Q&A
app.delete('/make-server-a177d153/training-qa/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in delete training QA: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const id = c.req.param('id');
    await kv.del(`trainingqa:${id}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Delete training QA error: ${error}`);
    return c.json({ error: 'Internal server error while deleting training data' }, 500);
  }
});

// Get documents
app.get('/make-server-a177d153/documents', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get documents: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const docs = await kv.getByPrefix('document:');
    const validDocs = docs.filter(doc => doc !== null && doc !== undefined);
    
    return c.json({ documents: validDocs });
  } catch (error) {
    console.log(`Get documents error: ${error}`);
    return c.json({ error: 'Internal server error while fetching documents' }, 500);
  }
});

// Add document
app.post('/make-server-a177d153/documents', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in add document: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const { name, content } = await c.req.json();
    
    if (!name) {
      return c.json({ error: 'Document name is required' }, 400);
    }

    const document = {
      id: `${Date.now()}_${Math.random()}`,
      name,
      content: content || '', // Store document content
      uploadedAt: Date.now(),
    };

    await kv.set(`document:${document.id}`, document);
    console.log(`Document saved: ${name} with content length: ${content?.length || 0}`);
    
    return c.json({ document });
  } catch (error) {
    console.log(`Add document error: ${error}`);
    return c.json({ error: 'Internal server error while adding document' }, 500);
  }
});

// Delete document
app.delete('/make-server-a177d153/documents/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in delete document: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const id = c.req.param('id');
    await kv.del(`document:${id}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Delete document error: ${error}`);
    return c.json({ error: 'Internal server error while deleting document' }, 500);
  }
});

// Get unanswered questions (for HR)
app.get('/make-server-a177d153/unanswered-questions', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get unanswered questions: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const questions = await kv.getByPrefix('unanswered:');
    const validQuestions = questions.filter(q => q !== null && q !== undefined);
    
    return c.json({ questions: validQuestions });
  } catch (error) {
    console.log(`Get unanswered questions error: ${error}`);
    return c.json({ error: 'Internal server error while fetching unanswered questions' }, 500);
  }
});

// Save unanswered question
app.post('/make-server-a177d153/unanswered-questions', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in save unanswered question: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const { question } = await c.req.json();
    
    if (!question) {
      return c.json({ error: 'Question is required' }, 400);
    }

    const unanswered = {
      id: `${Date.now()}_${Math.random()}`,
      question,
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      askedAt: Date.now(),
      status: 'pending',
    };

    await kv.set(`unanswered:${unanswered.id}`, unanswered);
    console.log(`Saved unanswered question: ${question}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Save unanswered question error: ${error}`);
    return c.json({ error: 'Internal server error while saving unanswered question' }, 500);
  }
});

// Answer and approve unanswered question (moves to training)
app.post('/make-server-a177d153/unanswered-questions/:id/answer', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in answer unanswered question: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const id = c.req.param('id');
    const { answer } = await c.req.json();
    
    if (!answer) {
      return c.json({ error: 'Answer is required' }, 400);
    }

    // Get the original question
    const unansweredQuestion = await kv.get(`unanswered:${id}`);
    
    if (!unansweredQuestion) {
      return c.json({ error: 'Question not found' }, 404);
    }

    // Create training Q&A from this
    const qa = {
      id: `${Date.now()}_${Math.random()}`,
      question: unansweredQuestion.question,
      answer,
      createdAt: Date.now(),
      source: 'from_unanswered',
      originalAsker: unansweredQuestion.userName,
    };

    await kv.set(`trainingqa:${qa.id}`, qa);
    
    // Delete from unanswered
    await kv.del(`unanswered:${id}`);
    
    console.log(`Approved and trained: ${unansweredQuestion.question}`);
    
    return c.json({ success: true, qa });
  } catch (error) {
    console.log(`Answer unanswered question error: ${error}`);
    return c.json({ error: 'Internal server error while answering question' }, 500);
  }
});

// Delete unanswered question (reject)
app.delete('/make-server-a177d153/unanswered-questions/:id', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in delete unanswered question: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const id = c.req.param('id');
    await kv.del(`unanswered:${id}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Delete unanswered question error: ${error}`);
    return c.json({ error: 'Internal server error while deleting unanswered question' }, 500);
  }
});

// Get chat history for a specific user
app.get('/make-server-a177d153/chat-history/:userId', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get chat history: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const userId = c.req.param('userId');
    
    // Users can only access their own history, HR can access anyone's
    if (user.id !== userId && user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: Cannot access other users chat history' }, 403);
    }

    const history = await kv.getByPrefix(`chat_history:${userId}:`);
    const validHistory = history.filter(msg => msg !== null && msg !== undefined);
    
    // Sort by timestamp
    validHistory.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`Retrieved ${validHistory.length} messages for user ${userId}`);
    
    return c.json({ history: validHistory });
  } catch (error) {
    console.log(`Get chat history error: ${error}`);
    return c.json({ error: 'Internal server error while fetching chat history' }, 500);
  }
});

// Get all users' chat histories (for HR dashboard)
app.get('/make-server-a177d153/all-chat-histories', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in get all chat histories: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    // Check if user is HR
    if (user.user_metadata?.role !== 'hr') {
      return c.json({ error: 'Forbidden: HR access only' }, 403);
    }

    const allHistory = await kv.getByPrefix('chat_history:');
    const validHistory = allHistory.filter(msg => msg !== null && msg !== undefined);
    
    // Group by userId
    const groupedByUser: Record<string, any[]> = {};
    validHistory.forEach(msg => {
      if (!groupedByUser[msg.userId]) {
        groupedByUser[msg.userId] = [];
      }
      groupedByUser[msg.userId].push(msg);
    });
    
    // Sort each user's messages by timestamp
    Object.keys(groupedByUser).forEach(userId => {
      groupedByUser[userId].sort((a, b) => a.timestamp - b.timestamp);
    });
    
    console.log(`Retrieved chat histories for ${Object.keys(groupedByUser).length} users`);
    
    return c.json({ histories: groupedByUser });
  } catch (error) {
    console.log(`Get all chat histories error: ${error}`);
    return c.json({ error: 'Internal server error while fetching all chat histories' }, 500);
  }
});

Deno.serve(app.fetch);