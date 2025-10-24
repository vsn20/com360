'use server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes user query and extracts intent and data for organization operations
 * @param {string} query - User's natural language query
 * @param {string} currentRoute - Current page route (e.g., '/organizations')
 * @param {Array} countries - List of available countries from database
 * @param {Array} states - List of available states from database
 * @returns {Object} - Parsed intent and data
 */
export async function gptintegration(query, currentRoute = '', countries = [], states = []) {
  try {
    // Build context with available countries and states
    const countryList = countries.length > 0 
      ? countries.map(c => `${c.ID}: ${c.VALUE}`).join(', ') 
      : 'Not provided';
    const stateList = states.length > 0 
      ? states.map(s => `${s.ID}: ${s.VALUE}`).join(', ') 
      : 'Not provided';

    const systemPrompt = `You are an AI assistant for a business management system analyzing queries about organizations.
Current date: October 24, 2025

Extract from user queries:
1. **Intent**: "add", "edit", "display", or "unknown"
2. **Entity**: "organization" (primary entity for this system)
3. **Data**: ALL fields mentioned for add/edit (name, address1, address2, country, state, postalcode, status)
4. **Filters**: ANY criteria for filtering (name patterns, dates, country, state, status, creator, etc.)

Available Countries (ID: Name): ${countryList}
Available States (ID: Name): ${stateList}

CRITICAL RULES:
- For countries/states: Match user input to closest name and return the ID as string
- For dates: Parse relative dates ("before oct 10", "after jan 1") and convert to YYYY-MM-DD format
  - If year not mentioned, use 2025
  - Support: before, after, between, on specific dates
- For name patterns: Detect "starting with", "ending with", "contains", "exact match"
- For addresses: Extract street, city, state, country, postal code from natural language
- Support MULTIPLE filters simultaneously (e.g., "names ending with 'vv' created before oct 10")

FILTERING CAPABILITIES:
The system can filter on these fields (even if not visible in table):
- suborgname (name patterns)
- country (by country ID or name)
- state (by state ID or name)
- isstatus (Active/Inactive)
- addresslane1, addresslane2 (address patterns)
- postalcode (postal code patterns)
- created_date (date comparisons)
- updated_date (date comparisons)
- created_by (creator patterns)
- updated_by (updater patterns)

EDIT BEHAVIOR:
- If query mentions specific organization + changes: Set requiresSelection to false, provide filter for exact match
- If query could match multiple orgs: Set requiresSelection to true
- If editing with location info (country/state): Include in filter AND data for update

EXAMPLES:

Query: "Show all organizations in India created before oct 10 2025"
Response: {
  "intent": "display",
  "entity": "organization",
  "data": null,
  "filters": [
    {"field": "country", "operator": "equals", "value": "91", "displayValue": "India"},
    {"field": "created_date", "operator": "before", "value": "2025-10-10"}
  ],
  "requiresSelection": false,
  "confidence": 0.95,
  "message": "Showing organizations in India created before October 10, 2025"
}

Query: "Create organization TechCorp at 123 Main St, California, USA, postal 94101"
Response: {
  "intent": "add",
  "entity": "organization",
  "data": {
    "suborgname": "TechCorp",
    "addresslane1": "123 Main St",
    "addresslane2": null,
    "country": "185",
    "state": "5",
    "postalcode": "94101",
    "isstatus": "Active"
  },
  "filters": [],
  "requiresSelection": false,
  "confidence": 0.95,
  "message": "Creating TechCorp in California, USA with address 123 Main St, postal code 94101"
}

Query: "Edit organization SaiTech in India to rename it to SaiTech Solutions"
Response: {
  "intent": "edit",
  "entity": "organization",
  "data": {
    "suborgname": "SaiTech Solutions",
    "addresslane1": null,
    "addresslane2": null,
    "country": null,
    "state": null,
    "postalcode": null,
    "isstatus": null
  },
  "filters": [
    {"field": "suborgname", "operator": "contains", "value": "SaiTech", "displayValue": "SaiTech"},
    {"field": "country", "operator": "equals", "value": "91", "displayValue": "India"}
  ],
  "requiresSelection": true,
  "confidence": 0.9,
  "message": "Found organizations matching 'SaiTech' in India. Please select one to rename to SaiTech Solutions."
}

Query: "Show organizations ending with vv created before oct 10"
Response: {
  "intent": "display",
  "entity": "organization",
  "data": null,
  "filters": [
    {"field": "suborgname", "operator": "endsWith", "value": "vv", "displayValue": "vv"},
    {"field": "created_date", "operator": "before", "value": "2025-10-10"}
  ],
  "requiresSelection": false,
  "confidence": 0.92,
  "message": "Showing organizations with names ending in 'vv' created before October 10, 2025"
}

Query: "Edit ABC Corp to change status to inactive and update address to 456 Park Ave"
Response: {
  "intent": "edit",
  "entity": "organization",
  "data": {
    "suborgname": null,
    "addresslane1": "456 Park Ave",
    "addresslane2": null,
    "country": null,
    "state": null,
    "postalcode": null,
    "isstatus": "Inactive"
  },
  "filters": [
    {"field": "suborgname", "operator": "equals", "value": "ABC Corp", "displayValue": "ABC Corp"}
  ],
  "requiresSelection": false,
  "confidence": 0.93,
  "message": "Updating ABC Corp status to Inactive and address to 456 Park Ave"
}

Query: "Show active organizations in California updated after jan 1 2025"
Response: {
  "intent": "display",
  "entity": "organization",
  "data": null,
  "filters": [
    {"field": "isstatus", "operator": "equals", "value": "1", "displayValue": "Active"},
    {"field": "state", "operator": "equals", "value": "5", "displayValue": "California"},
    {"field": "updated_date", "operator": "after", "value": "2025-01-01"}
  ],
  "requiresSelection": false,
  "confidence": 0.94,
  "message": "Showing active organizations in California updated after January 1, 2025"
}

RESPONSE FORMAT (JSON only):
{
  "intent": "add|edit|display|unknown",
  "entity": "organization",
  "data": {
    "suborgname": "value or null",
    "addresslane1": "value or null",
    "addresslane2": "value or null",
    "country": "ID string or null",
    "state": "ID string or null",
    "postalcode": "value or null",
    "isstatus": "Active|Inactive or null"
  },
  "filters": [
    {
      "field": "field_name",
      "operator": "equals|contains|startsWith|endsWith|before|after|between",
      "value": "filter_value",
      "displayValue": "human readable value",
      "value2": "optional second value for between operator"
    }
  ],
  "requiresSelection": true/false,
  "confidence": 0.0-1.0,
  "message": "Clear user message explaining what will happen"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse JSON response
    let parsedResponse;
    try {
      const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
      
      // Ensure filters is always an array
      if (!Array.isArray(parsedResponse.filters)) {
        parsedResponse.filters = [];
      }
      
    } catch (parseError) {
      console.error('Failed to parse GPT response:', responseText);
      return {
        intent: 'unknown',
        entity: 'unknown',
        data: null,
        filters: [],
        requiresSelection: false,
        confidence: 0,
        message: 'Sorry, I could not understand your request. Please try rephrasing.',
        error: 'Parse error'
      };
    }

    return parsedResponse;

  } catch (error) {
    console.error('GPT Integration Error:', error);
    return {
      intent: 'unknown',
      entity: 'unknown',
      data: null,
      filters: [],
      requiresSelection: false,
      confidence: 0,
      message: 'An error occurred while processing your request.',
      error: error.message
    };
  }
}