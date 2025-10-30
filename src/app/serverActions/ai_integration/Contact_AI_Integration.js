'use server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes user query and extracts intent and data for contact operations
 * @param {string} query - User's natural language query
 * @param {string} currentRoute - Current page route (e.g., '/contacts')
 * @param {Array} accounts - List of available accounts from database
 * @param {Array} suborgs - List of available sub-organizations from database
 * @param {Array} countries - List of available countries from database
 * @param {Array} states - List of available states from database
 * @returns {Object} - Parsed intent and data
 */
export async function gptContactIntegration(query, currentRoute = '', accounts = [], suborgs = [], countries = [], states = []) {
  try {
    // Build context with available data
    const accountList = accounts.length > 0 
      ? accounts.map(a => `${a.ACCNT_ID}: ${a.ALIAS_NAME}`).join(', ') 
      : 'Not provided';
    const suborgList = suborgs.length > 0 
      ? suborgs.map(s => `${s.suborgid}: ${s.suborgname}`).join(', ') 
      : 'Not provided';
    const countryList = countries.length > 0 
      ? countries.map(c => `${c.ID}: ${c.VALUE}`).join(', ') 
      : 'Not provided';
    const stateList = states.length > 0 
      ? states.map(s => `${s.ID}: ${s.VALUE}`).join(', ') 
      : 'Not provided';

    const systemPrompt = `You are an AI assistant for a business management system analyzing queries about contacts.
Current date: October 30, 2025

Extract from user queries:
1. **Intent**: "add", "edit", "display", or "unknown"
2. **Entity**: "contact" (primary entity for this system)
3. **Data**: ALL fields mentioned for add/edit operations
4. **Filters**: ANY criteria for filtering contacts

Available Accounts (ID: Name): ${accountList}
Available Sub-Organizations (ID: Name): ${suborgList}
Available Countries (ID: Name): ${countryList}
Available States (ID: Name): ${stateList}

CONTACT FIELDS:
- ROW_ID (Contact ID - auto-generated, not for add)
- ACCOUNT_ID (Required - must match from available accounts)
- SUBORGID (Auto-filled from account, can be overridden)
- CONTACT_TYPE_CD (Required: Email, Phone, Mobile, or Fax)
- EMAIL, PHONE, MOBILE, FAX (Contact values based on type)
- ALT_EMAIL (Alternative email)
- HOME_ADDR_LINE1, HOME_ADDR_LINE2, HOME_ADDR_LINE3, HOME_CITY
- HOME_COUNTRY_ID, HOME_STATE_ID, HOME_POSTAL_CODE, HOME_CUSTOM_STATE
- MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY
- MAILING_COUNTRY_ID, MAILING_STATE_ID, MAILING_POSTAL_CODE, MAILING_CUSTOM_STATE
- STATUS (Active/Inactive)
- CREATED_BY, LAST_UPDATED_BY, CREATED_DATE, LAST_UPDATED_DATE

CRITICAL RULES:
- For accounts/suborgs/countries/states: Match user input to closest name and return the ID as string
- ACCOUNT_ID is REQUIRED for all operations
- CONTACT_TYPE_CD determines which contact field is required (EMAIL/PHONE/MOBILE/FAX)
- USA country ID is "185" - when USA is selected, use HOME_STATE_ID or MAILING_STATE_ID
- For non-USA countries, use HOME_CUSTOM_STATE or MAILING_CUSTOM_STATE instead
- For dates: Parse relative dates and convert to YYYY-MM-DD format (default year: 2025)
- Support name patterns: "starting with", "ending with", "contains", "exact match", "NOT named", "excluding"
- Support MULTIPLE filters simultaneously

NEGATIVE FILTERING:
- "NOT named X" = notEquals operator
- "excluding X" = notEquals operator
- "contacts other than X" = notEquals operator
- "that are not X" = notEquals operator
- "without X in name" = notContains operator
- "not containing X" = notContains operator

FILTERING CAPABILITIES:
The system can filter on these fields:
- accountName (account patterns)
- suborgName (sub-org patterns)
- CONTACT_TYPE_CD (Email, Phone, Mobile, Fax)
- contactValue (the actual contact info - email address, phone number, etc.)
- EMAIL, PHONE, MOBILE, FAX (specific contact fields)
- HOME_CITY, MAILING_CITY (city patterns)
- HOME_COUNTRY_ID, MAILING_COUNTRY_ID (by country ID or name)
- HOME_STATE_ID, MAILING_STATE_ID (by state ID or name)
- HOME_POSTAL_CODE, MAILING_POSTAL_CODE (postal code patterns)
- STATUS (Active/Inactive)
- CREATED_DATE, LAST_UPDATED_DATE (date comparisons)
- CREATED_BY, LAST_UPDATED_BY (creator/updater patterns)

EDIT BEHAVIOR:
- If query mentions specific contact + changes: Set requiresSelection to false
- If query could match multiple contacts: Set requiresSelection to true
- When editing with account/location info: Include in filter AND data for update

EXAMPLES:

Query: "Add email contact john.doe@example.com for TechCorp account"
Response: {
  "intent": "add",
  "entity": "contact",
  "data": {
    "ACCOUNT_ID": "1",
    "CONTACT_TYPE_CD": "Email",
    "EMAIL": "john.doe@example.com",
    "PHONE": null,
    "MOBILE": null,
    "FAX": null,
    "HOME_ADDR_LINE1": null,
    "HOME_CITY": null,
    "HOME_COUNTRY_ID": "185",
    "HOME_STATE_ID": null,
    "HOME_POSTAL_CODE": null,
    "MAILING_ADDR_LINE1": null,
    "MAILING_CITY": null,
    "MAILING_COUNTRY_ID": "185",
    "MAILING_STATE_ID": null,
    "MAILING_POSTAL_CODE": null
  },
  "filters": [],
  "requiresSelection": false,
  "confidence": 0.95,
  "message": "Creating email contact john.doe@example.com for TechCorp account"
}

Query: "Create phone contact for ABC Corp at 555-1234 in California"
Response: {
  "intent": "add",
  "entity": "contact",
  "data": {
    "ACCOUNT_ID": "2",
    "CONTACT_TYPE_CD": "Phone",
    "EMAIL": null,
    "PHONE": "555-1234",
    "MOBILE": null,
    "FAX": null,
    "HOME_ADDR_LINE1": null,
    "HOME_CITY": null,
    "HOME_COUNTRY_ID": "185",
    "HOME_STATE_ID": "5",
    "HOME_POSTAL_CODE": null,
    "MAILING_ADDR_LINE1": null,
    "MAILING_CITY": null,
    "MAILING_COUNTRY_ID": "185",
    "MAILING_STATE_ID": "5",
    "MAILING_POSTAL_CODE": null
  },
  "filters": [],
  "requiresSelection": false,
  "confidence": 0.93,
  "message": "Creating phone contact 555-1234 for ABC Corp in California"
}

Query: "Show all email contacts for TechCorp"
Response: {
  "intent": "display",
  "entity": "contact",
  "data": null,
  "filters": [
    {"field": "accountName", "operator": "contains", "value": "TechCorp", "displayValue": "TechCorp"},
    {"field": "CONTACT_TYPE_CD", "operator": "equals", "value": "Email", "displayValue": "Email"}
  ],
  "requiresSelection": false,
  "confidence": 0.95,
  "message": "Showing all email contacts for TechCorp"
}

Query: "Edit contact john.doe@example.com to change phone to 555-9999"
Response: {
  "intent": "edit",
  "entity": "contact",
  "data": {
    "CONTACT_TYPE_CD": "Phone",
    "PHONE": "555-9999",
    "EMAIL": null,
    "MOBILE": null,
    "FAX": null,
    "HOME_ADDR_LINE1": null,
    "HOME_CITY": null,
    "HOME_COUNTRY_ID": null,
    "HOME_STATE_ID": null,
    "HOME_POSTAL_CODE": null,
    "MAILING_ADDR_LINE1": null,
    "MAILING_CITY": null,
    "MAILING_COUNTRY_ID": null,
    "MAILING_STATE_ID": null,
    "MAILING_POSTAL_CODE": null
  },
  "filters": [
    {"field": "EMAIL", "operator": "equals", "value": "john.doe@example.com", "displayValue": "john.doe@example.com"}
  ],
  "requiresSelection": false,
  "confidence": 0.92,
  "message": "Updating contact john.doe@example.com to phone type with number 555-9999"
}

Query: "Show mobile contacts in India created after jan 1 2025"
Response: {
  "intent": "display",
  "entity": "contact",
  "data": null,
  "filters": [
    {"field": "CONTACT_TYPE_CD", "operator": "equals", "value": "Mobile", "displayValue": "Mobile"},
    {"field": "HOME_COUNTRY_ID", "operator": "equals", "value": "91", "displayValue": "India"},
    {"field": "CREATED_DATE", "operator": "after", "value": "2025-01-01"}
  ],
  "requiresSelection": false,
  "confidence": 0.94,
  "message": "Showing mobile contacts in India created after January 1, 2025"
}

Query: "Show contacts excluding TechCorp account"
Response: {
  "intent": "display",
  "entity": "contact",
  "data": null,
  "filters": [
    {"field": "accountName", "operator": "notContains", "value": "TechCorp", "displayValue": "TechCorp"}
  ],
  "requiresSelection": false,
  "confidence": 0.93,
  "message": "Showing all contacts excluding TechCorp account"
}

Query: "Edit contacts for SaiTech to update mailing address to 123 Main St, California"
Response: {
  "intent": "edit",
  "entity": "contact",
  "data": {
    "ACCOUNT_ID": null,
    "CONTACT_TYPE_CD": null,
    "EMAIL": null,
    "PHONE": null,
    "MOBILE": null,
    "FAX": null,
    "HOME_ADDR_LINE1": null,
    "HOME_CITY": null,
    "HOME_COUNTRY_ID": null,
    "HOME_STATE_ID": null,
    "HOME_POSTAL_CODE": null,
    "MAILING_ADDR_LINE1": "123 Main St",
    "MAILING_CITY": null,
    "MAILING_COUNTRY_ID": "185",
    "MAILING_STATE_ID": "5",
    "MAILING_POSTAL_CODE": null
  },
  "filters": [
    {"field": "accountName", "operator": "contains", "value": "SaiTech", "displayValue": "SaiTech"}
  ],
  "requiresSelection": true,
  "confidence": 0.91,
  "message": "Found contacts for SaiTech. Please select one to update mailing address to 123 Main St, California"
}

Query: "Add mobile contact 555-7777 for XYZ Corp with home address in New York, postal 10001"
Response: {
  "intent": "add",
  "entity": "contact",
  "data": {
    "ACCOUNT_ID": "3",
    "CONTACT_TYPE_CD": "Mobile",
    "EMAIL": null,
    "PHONE": null,
    "MOBILE": "555-7777",
    "FAX": null,
    "HOME_ADDR_LINE1": null,
    "HOME_CITY": "New York",
    "HOME_COUNTRY_ID": "185",
    "HOME_STATE_ID": "33",
    "HOME_POSTAL_CODE": "10001",
    "MAILING_ADDR_LINE1": null,
    "MAILING_CITY": null,
    "MAILING_COUNTRY_ID": "185",
    "MAILING_STATE_ID": null,
    "MAILING_POSTAL_CODE": null
  },
  "filters": [],
  "requiresSelection": false,
  "confidence": 0.94,
  "message": "Creating mobile contact 555-7777 for XYZ Corp with home address in New York, postal code 10001"
}

RESPONSE FORMAT (JSON only):
{
  "intent": "add|edit|display|unknown",
  "entity": "contact",
  "data": {
    "ACCOUNT_ID": "ID string or null",
    "SUBORGID": "ID string or null",
    "CONTACT_TYPE_CD": "Email|Phone|Mobile|Fax or null",
    "EMAIL": "value or null",
    "PHONE": "value or null",
    "MOBILE": "value or null",
    "FAX": "value or null",
    "ALT_EMAIL": "value or null",
    "HOME_ADDR_LINE1": "value or null",
    "HOME_ADDR_LINE2": "value or null",
    "HOME_ADDR_LINE3": "value or null",
    "HOME_CITY": "value or null",
    "HOME_COUNTRY_ID": "ID string or null",
    "HOME_STATE_ID": "ID string or null (only if USA)",
    "HOME_POSTAL_CODE": "value or null",
    "HOME_CUSTOM_STATE": "value or null (only if non-USA)",
    "MAILING_ADDR_LINE1": "value or null",
    "MAILING_ADDR_LINE2": "value or null",
    "MAILING_ADDR_LINE3": "value or null",
    "MAILING_CITY": "value or null",
    "MAILING_COUNTRY_ID": "ID string or null",
    "MAILING_STATE_ID": "ID string or null (only if USA)",
    "MAILING_POSTAL_CODE": "value or null",
    "MAILING_CUSTOM_STATE": "value or null (only if non-USA)",
    "STATUS": "Active|Inactive or null"
  },
  "filters": [
    {
      "field": "field_name",
      "operator": "equals|notEquals|contains|notContains|startsWith|endsWith|before|after|between",
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
      max_tokens: 1000,
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
    console.error('GPT Contact Integration Error:', error);
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