// extract-pdf-fields.js
// Run this script to extract all form field names from your I-9 PDF template
// Usage: node extract-pdf-fields.js

import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

async function extractPDFFields() {
  try {
    console.log('\n🔍 Extracting PDF Form Fields...\n');
    
    // Path to your I-9 template
    const templatePath = path.join(process.cwd(), 'public', 'templates', '1760217680073_i-9.pdf');
    
    // Check if file exists
    try {
      await fs.access(templatePath);
      console.log('✅ Template file found:', templatePath, '\n');
    } catch (err) {
      console.error('❌ Template file not found at:', templatePath);
      console.error('Please check the file path and try again.\n');
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
      console.log('This means it\'s a flat PDF without fillable fields.');
      console.log('You\'ll need to use coordinate-based text drawing instead.\n');
      return;
    }
    
    console.log('========================================');
    console.log('📋 TOTAL FORM FIELDS FOUND:', fields.length);
    console.log('========================================\n');
    
    // Group fields by type
    const fieldsByType = {
      text: [],
      checkbox: [],
      radio: [],
      dropdown: [],
      button: [],
      other: []
    };
    
    // Categorize and collect field info
    fields.forEach((field, index) => {
      const type = field.constructor.name;
      const name = field.getName();
      
      const fieldInfo = {
        index: index + 1,
        name: name,
        type: type
      };
      
      // Try to get additional info for text fields
      if (type === 'PDFTextField') {
        try {
          fieldInfo.maxLength = field.getMaxLength();
          fieldInfo.value = field.getText() || '(empty)';
        } catch (e) {
          // Some fields don't support these methods
        }
        fieldsByType.text.push(fieldInfo);
      } else if (type === 'PDFCheckBox') {
        try {
          fieldInfo.checked = field.isChecked();
        } catch (e) {}
        fieldsByType.checkbox.push(fieldInfo);
      } else if (type === 'PDFRadioGroup') {
        fieldsByType.radio.push(fieldInfo);
      } else if (type === 'PDFDropdown') {
        fieldsByType.dropdown.push(fieldInfo);
      } else if (type === 'PDFButton') {
        fieldsByType.button.push(fieldInfo);
      } else {
        fieldsByType.other.push(fieldInfo);
      }
    });
    
    // Print organized results
    console.log('\n📝 TEXT FIELDS (' + fieldsByType.text.length + ')');
    console.log('─'.repeat(80));
    fieldsByType.text.forEach(f => {
      console.log(`${f.index}. "${f.name}"`);
      if (f.maxLength) console.log(`   Max Length: ${f.maxLength}`);
      if (f.value && f.value !== '(empty)') console.log(`   Current Value: ${f.value}`);
      console.log();
    });
    
    if (fieldsByType.checkbox.length > 0) {
      console.log('\n☑️  CHECKBOXES (' + fieldsByType.checkbox.length + ')');
      console.log('─'.repeat(80));
      fieldsByType.checkbox.forEach(f => {
        console.log(`${f.index}. "${f.name}"`);
        if (f.checked !== undefined) console.log(`   Checked: ${f.checked}`);
        console.log();
      });
    }
    
    if (fieldsByType.radio.length > 0) {
      console.log('\n🔘 RADIO BUTTONS (' + fieldsByType.radio.length + ')');
      console.log('─'.repeat(80));
      fieldsByType.radio.forEach(f => {
        console.log(`${f.index}. "${f.name}"`);
        console.log();
      });
    }
    
    if (fieldsByType.dropdown.length > 0) {
      console.log('\n📋 DROPDOWNS (' + fieldsByType.dropdown.length + ')');
      console.log('─'.repeat(80));
      fieldsByType.dropdown.forEach(f => {
        console.log(`${f.index}. "${f.name}"`);
        console.log();
      });
    }
    
    if (fieldsByType.other.length > 0) {
      console.log('\n❓ OTHER FIELDS (' + fieldsByType.other.length + ')');
      console.log('─'.repeat(80));
      fieldsByType.other.forEach(f => {
        console.log(`${f.index}. "${f.name}" (${f.type})`);
        console.log();
      });
    }
    
    // Generate mapping template
    console.log('\n========================================');
    console.log('📄 SUGGESTED FIELD MAPPING CODE');
    console.log('========================================\n');
    console.log('Copy this code into your generateI9PDF function:\n');
    
    console.log('// Section 1: Employee Information');
    const section1Fields = [
      'Last_Name', 'First_Name', 'Middle', 'Other_Last',
      'Address', 'Street', 'Apt', 'City', 'State', 'ZIP',
      'Date_of_Birth', 'DOB', 'Social_Security', 'SSN',
      'Email', 'Telephone', 'Phone'
    ];
    
    fieldsByType.text.filter(f => 
      section1Fields.some(keyword => f.name.toLowerCase().includes(keyword.toLowerCase()))
    ).forEach(f => {
      console.log(`safeSetField(form, '${f.name}', employeeData.FIELD_NAME);`);
    });
    
    console.log('\n// Citizenship checkboxes');
    fieldsByType.checkbox.filter(f => 
      f.name.toLowerCase().includes('citizen') || 
      f.name.toLowerCase().includes('alien') ||
      f.name.toLowerCase().includes('permanent')
    ).forEach(f => {
      console.log(`safeCheckBox(form, '${f.name}'); // For citizenship status`);
    });
    
    console.log('\n// Section 2: Employer/Verifier Information');
    const section2Fields = [
      'First_Day', 'Employment', 'Document', 'Title',
      'Issuing', 'Authority', 'Number', 'Expiration',
      'Employer', 'Business', 'Organization', 'Address'
    ];
    
    fieldsByType.text.filter(f => 
      section2Fields.some(keyword => f.name.toLowerCase().includes(keyword.toLowerCase()))
    ).forEach(f => {
      console.log(`safeSetField(form, '${f.name}', formData.FIELD_NAME);`);
    });
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'pdf-fields-output.txt');
    let output = 'PDF FORM FIELDS EXTRACTION REPORT\n';
    output += '='.repeat(80) + '\n\n';
    output += `Template: ${templatePath}\n`;
    output += `Total Fields: ${fields.length}\n\n`;
    
    fields.forEach((field, index) => {
      output += `${index + 1}. Field Name: "${field.getName()}"\n`;
      output += `   Type: ${field.constructor.name}\n\n`;
    });
    
    await fs.writeFile(outputPath, output);
    console.log(`\n✅ Full report saved to: ${outputPath}\n`);
    
  } catch (error) {
    console.error('❌ Error extracting PDF fields:', error);
    console.error('\nStack trace:', error.stack);
  }
}

// Run the extraction
extractPDFFields();