// extract-w9-pdf-fields.js
// Run this script to extract all form field names from your W-9 PDF template
// Usage: node extract-w9-pdf-fields.js

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function extractW9PDFFields() {
  try {
    console.log('\n🔍 Extracting W-9 PDF Form Fields...\n');
    
    // Path to your W-9 template
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'fw9.pdf');
    
    // Check if file exists
    try {
      await fs.access(templatePath);
      console.log('✅ W-9 Template file found:', templatePath, '\n');
    } catch (err) {
      console.error('❌ W-9 Template file not found at:', templatePath);
      console.error('Please make sure you have placed fw9.pdf in the /public/templates/ directory.\n');
      return;
    }
    
    // Load PDF
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Get form
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    if (fields.length === 0) {
      console.log('⚠️  WARNING: This PDF has NO form fields!');
      return;
    }
    
    console.log('========================================');
    console.log('📋 TOTAL W-9 FORM FIELDS FOUND:', fields.length);
    console.log('========================================\n');
    
    let report = '';
    fields.forEach((field, index) => {
      const type = field.constructor.name;
      const name = field.getName();
      const line = `${index + 1}. Field Name: "${name}" | Type: ${type}\n`;
      console.log(line);
      report += line;
    });
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'w9-pdf-fields-output.txt');
    await fs.writeFile(outputPath, report);
    console.log(`\n✅ Full report saved to: ${outputPath}\n`);
    
  } catch (error) {
    console.error('❌ Error extracting W-9 PDF fields:', error);
  }
}

// Run the extraction
extractW9PDFFields();
