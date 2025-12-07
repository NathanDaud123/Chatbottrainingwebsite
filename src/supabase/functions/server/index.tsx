import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Signup route
app.post('/make-server-a177d153/signup', async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create user with Supabase Auth
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
    console.log(`Signup exception: ${error}`);
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

// Save chat log
app.post('/make-server-a177d153/chat-logs', async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      console.log(`Auth error in save chat log: ${authError?.message}`);
      return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }

    const { message, response } = await c.req.json();
    
    if (!message || !response) {
      return c.json({ error: 'Missing message or response' }, 400);
    }

    const chatLog = {
      id: `${Date.now()}_${Math.random()}`,
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      message,
      response,
      timestamp: Date.now(),
    };

    console.log('Saving chat log:', chatLog);
    await kv.set(`chatlog:${chatLog.id}`, chatLog);
    console.log('Chat log saved successfully');
    
    return c.json({ success: true, log: chatLog });
  } catch (error) {
    console.log(`Save chat log error: ${error}`);
    return c.json({ error: 'Internal server error while saving chat log' }, 500);
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

// Add training Q&A (HR only)
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
      return c.json({ error: 'Missing question or answer' }, 400);
    }

    const qa = {
      id: `${Date.now()}_${Math.random()}`,
      question,
      answer,
      createdAt: Date.now(),
    };

    await kv.set(`trainingqa:${qa.id}`, qa);
    
    return c.json({ success: true, qa });
  } catch (error) {
    console.log(`Add training QA error: ${error}`);
    return c.json({ error: 'Internal server error while adding training data' }, 500);
  }
});

// Delete training Q&A (HR only)
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

// Add document (HR only)
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

    const { name } = await c.req.json();
    
    if (!name) {
      return c.json({ error: 'Missing document name' }, 400);
    }

    const doc = {
      id: `${Date.now()}_${Math.random()}`,
      name,
      uploadedAt: Date.now(),
      uploadedBy: user.id,
    };

    await kv.set(`document:${doc.id}`, doc);
    
    return c.json({ success: true, document: doc });
  } catch (error) {
    console.log(`Add document error: ${error}`);
    return c.json({ error: 'Internal server error while adding document' }, 500);
  }
});

// Delete document (HR only)
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

Deno.serve(app.fetch);