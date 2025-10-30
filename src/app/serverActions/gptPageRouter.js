'use server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Determines which page to route to based on user query
 * Ultra-minimal GPT call for cost efficiency
 */
export async function gptPageRouter(query) {
  try {
    // Very short, concise prompt to minimize tokens
    const systemPrompt = `Classify query into: "org" (organizations/companies) or "contact" (people/contacts). Default to "contact" if unclear.

Examples:
"show companies in india" → org
"create contact john" → contact  
"edit ABC Corp" → org
"show people in california" → contact
"help" → contact

Reply with just: org or contact`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cheapest model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.1,
      max_tokens: 10, // Minimal tokens needed
    });

    const response = completion.choices[0].message.content.trim().toLowerCase();
    
    // Parse simple response
    let route, pageName;
    
    if (response.includes('org')) {
      route = '/userscreens/organizations';
      pageName = 'Organizations';
    } else {
      route = '/userscreens/contacts';
      pageName = 'Contacts';
    }
    
    return {
      route,
      pageName,
      confidence: 0.9,
      reason: `Classified as ${pageName}`,
      query
    };
    
  } catch (error) {
    console.error('GPT Router Error:', error);
    return {
      route: '/userscreens/contacts',
      pageName: 'Contacts',
      confidence: 0.5,
      reason: 'Error, defaulting to Contacts',
      query,
      error: error.message
    };
  }
}