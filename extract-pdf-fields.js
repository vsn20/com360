// extract-w4-pdf-fields.js
// Run this script to extract all form field names from your W-4 PDF template
// Usage: node extract-w4-pdf-fields.js

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function extractW4PDFFields() {
  try {
    console.log('\n📋 Extracting W-4 PDF Form Fields...\n');
    
    // Path to your W-4 template
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'i983.pdf');
    
    // Check if file exists
    try {
      await fs.access(templatePath);
      console.log('✅ W-4 Template file found:', templatePath, '\n');
    } catch (err) {
      console.error('❌ W-4 Template file not found at:', templatePath);
      console.error('Please make sure you have placed fw4.pdf in the /public/templates/ directory.\n');
      return;
    }
    
    // Load PDF
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    
    // Check for XFA
    let isXFA = false;
    try {
      isXFA = pdfDoc.catalog.AcroForm?.dict?.has?.('XFA') ?? false;
      if (isXFA) {
        console.log('⚠️  WARNING: This PDF contains XFA data!');
        console.log('   XFA forms may not work reliably with pdf-lib.');
        console.log('   You should use an AcroForm version of fw4.pdf instead.\n');
      } else {
        console.log('✅ PDF appears to be AcroForm (no XFA detected)\n');
      }
    } catch (xfaError) {
      console.warn('⚠️  Could not check for XFA:', xfaError.message, '\n');
    }
    
    // Get form
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    if (fields.length === 0) {
      console.log('⚠️  WARNING: This PDF has NO form fields!');
      console.log('   The PDF may be a scanned image or flattened form.');
      return;
    }
    
    console.log('========================================');
    console.log('📋 TOTAL W-4 FORM FIELDS FOUND:', fields.length);
    console.log('========================================\n');
    
    let report = 'W-4 PDF FIELD NAMES\n';
    report += '===================\n\n';
    
    // Group fields by type
    const textFields = [];
    const checkBoxes = [];
    const otherFields = [];
    
    fields.forEach((field, index) => {
      const type = field.constructor.name;
      const name = field.getName();
      const line = `${index + 1}. "${name}" | Type: ${type}\n`;
      
      console.log(line);
      report += line;
      
      if (type === 'PDFTextField') {
        textFields.push(name);
      } else if (type === 'PDFCheckBox') {
        checkBoxes.push(name);
      } else {
        otherFields.push(name);
      }
    });
    
    // Add summary
    report += '\n========================================\n';
    report += 'FIELD SUMMARY\n';
    report += '========================================\n';
    report += `Text Fields: ${textFields.length}\n`;
    report += `Check Boxes: ${checkBoxes.length}\n`;
    report += `Other Fields: ${otherFields.length}\n`;
    report += `TOTAL: ${fields.length}\n\n`;
    
    // Add grouped fields
    report += '========================================\n';
    report += 'TEXT FIELDS\n';
    report += '========================================\n';
    textFields.forEach((name, i) => {
      report += `${i + 1}. "${name}"\n`;
    });
    
    report += '\n========================================\n';
    report += 'CHECK BOXES\n';
    report += '========================================\n';
    checkBoxes.forEach((name, i) => {
      report += `${i + 1}. "${name}"\n`;
    });
    
    if (otherFields.length > 0) {
      report += '\n========================================\n';
      report += 'OTHER FIELDS\n';
      report += '========================================\n';
      otherFields.forEach((name, i) => {
        report += `${i + 1}. "${name}"\n`;
      });
    }
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'I983-pdf-fields-output.txt');
    await fs.writeFile(outputPath, report);
    console.log(`\n✅ Full report saved to: ${outputPath}\n`);
    
    // Create a mapping template
    const mappingTemplate = `
// W-4 PDF FIELD MAPPING TEMPLATE
// Copy this into your generateW4PDF function

// Step 1: Employee Info
setSafeText('${textFields[0] || 'FIELD_NAME_HERE'}', w4Data.FIRST_NAME || '');  // First Name
setSafeText('${textFields[1] || 'FIELD_NAME_HERE'}', w4Data.LAST_NAME || '');   // Last Name
setSafeText('${textFields[2] || 'FIELD_NAME_HERE'}', pdfSSN);                    // SSN
setSafeText('${textFields[3] || 'FIELD_NAME_HERE'}', w4Data.ADDRESS_STREET || ''); // Address
setSafeText('${textFields[4] || 'FIELD_NAME_HERE'}', w4Data.ADDRESS_CITY_STATE_ZIP || ''); // City/State/ZIP

// Filing Status (checkboxes)
if (w4Data.FILING_STATUS === 'SINGLE') checkSafeBox('${checkBoxes[0] || 'CHECKBOX_NAME_HERE'}');
else if (w4Data.FILING_STATUS === 'MARRIED_JOINTLY') checkSafeBox('${checkBoxes[1] || 'CHECKBOX_NAME_HERE'}');
else if (w4Data.FILING_STATUS === 'HEAD_OF_HOUSEHOLD') checkSafeBox('${checkBoxes[2] || 'CHECKBOX_NAME_HERE'}');

// Step 2: Multiple Jobs
if (w4Data.MULTIPLE_JOBS_CHECKED) checkSafeBox('${checkBoxes[3] || 'CHECKBOX_NAME_HERE'}');

// Step 3: Dependents
setSafeText('${textFields[5] || 'FIELD_NAME_HERE'}', String(Number(w4Data.QUALIFYING_CHILDREN_AMOUNT || 0).toFixed(0)));
setSafeText('${textFields[6] || 'FIELD_NAME_HERE'}', String(Number(w4Data.OTHER_DEPENDENTS_AMOUNT || 0).toFixed(0)));
setSafeText('${textFields[7] || 'FIELD_NAME_HERE'}', String(Number(w4Data.TOTAL_CREDITS || 0).toFixed(0)));

// Step 4: Other Adjustments
setSafeText('${textFields[8] || 'FIELD_NAME_HERE'}', String(Number(w4Data.OTHER_INCOME || 0).toFixed(0)));
setSafeText('${textFields[9] || 'FIELD_NAME_HERE'}', String(Number(w4Data.DEDUCTIONS || 0).toFixed(0)));
setSafeText('${textFields[10] || 'FIELD_NAME_HERE'}', String(Number(w4Data.EXTRA_WITHHOLDING || 0).toFixed(0)));

// Step 5: Signature Date
setSafeText('${textFields[11] || 'FIELD_NAME_HERE'}', formatPdfDate(w4Data.EMPLOYEE_SIGNATURE_DATE));

// Employer Section (if VERIFIED)
if (w4Data.FORM_STATUS === 'VERIFIED') {
  setSafeText('${textFields[12] || 'FIELD_NAME_HERE'}', w4Data.EMPLOYER_NAME_ADDRESS || '');
  setSafeText('${textFields[13] || 'FIELD_NAME_HERE'}', formatPdfDate(w4Data.FIRST_DATE_OF_EMPLOYMENT));
  setSafeText('${textFields[14] || 'FIELD_NAME_HERE'}', w4Data.EMPLOYER_EIN || '');
}
`;
    
    const mappingPath = path.join(process.cwd(), 'w4-field-mapping-template.txt');
    await fs.writeFile(mappingPath, mappingTemplate);
    console.log(`✅ Field mapping template saved to: ${mappingPath}\n`);
    
  } catch (error) {
    console.error('❌ Error extracting W-4 PDF fields:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the extraction
extractW4PDFFields();