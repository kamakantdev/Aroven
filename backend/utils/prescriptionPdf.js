/**
 * Prescription PDF Generator
 * Generates a clean, professional prescription PDF using PDFKit.
 * Returns a Buffer that can be uploaded to MinIO.
 */

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch {
  PDFDocument = null;
}

/**
 * Generate a prescription PDF buffer.
 * @param {Object} prescription - Full prescription object with doctor, patient, medicines
 * @returns {Promise<Buffer>} PDF buffer ready for upload
 */
const generatePrescriptionPdf = async (prescription) => {
  if (!PDFDocument) {
    console.warn('[PrescriptionPDF] pdfkit not installed — skipping PDF generation');
    return null;
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        compress: true,        // Enable PDF stream compression (zlib deflate)
        autoFirstPage: true,
        bufferPages: false,    // Stream pages instead of buffering all (memory-efficient)
        info: {
          Title: 'Prescription',
          Author: 'Swastik Healthcare',
          Creator: 'Swastik Healthcare Platform',
        },
      });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - 100; // 50px margins on each side

      // ==================== Header ====================
      doc.fontSize(20).font('Helvetica-Bold').text('SWASTIK HEALTHCARE', { align: 'center' });
      doc.fontSize(9).font('Helvetica').text('Digital Prescription', { align: 'center' });
      doc.moveDown(0.5);

      // Divider line
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#10b981');
      doc.moveDown(0.5);

      // ==================== Prescription Info ====================
      const rxNumber = prescription.prescription_number || 'N/A';
      const createdAt = prescription.created_at
        ? new Date(prescription.created_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : 'N/A';
      const validUntil = prescription.valid_until
        ? new Date(prescription.valid_until).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : 'N/A';

      doc.fontSize(10).font('Helvetica-Bold').text(`Rx: ${rxNumber}`, { continued: true });
      doc.font('Helvetica').text(`    Date: ${createdAt}    Valid until: ${validUntil}`, { align: 'right' });
      doc.moveDown(0.5);

      // ==================== Doctor Info ====================
      if (prescription.doctor) {
        doc.fontSize(11).font('Helvetica-Bold').text(`Dr. ${prescription.doctor.name || 'Unknown'}`);
        if (prescription.doctor.specialization) {
          doc.fontSize(9).font('Helvetica').text(prescription.doctor.specialization);
        }
        doc.moveDown(0.3);
      }

      // ==================== Patient Info ====================
      if (prescription.patient) {
        doc.fontSize(10).font('Helvetica').text(`Patient: ${prescription.patient.name || 'Unknown'}`, {
          continued: prescription.patient.phone ? true : false,
        });
        if (prescription.patient.phone) {
          doc.text(`    Phone: ${prescription.patient.phone}`);
        }
        doc.moveDown(0.3);
      }

      // ==================== Diagnosis ====================
      if (prescription.diagnosis) {
        doc.fontSize(10).font('Helvetica-Bold').text('Diagnosis: ', { continued: true });
        doc.font('Helvetica').text(prescription.diagnosis);
        doc.moveDown(0.3);
      }

      // Divider
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#d1d5db');
      doc.moveDown(0.5);

      // ==================== Medicines Table ====================
      const medicines = prescription.prescription_medicines || prescription.medicines || [];

      if (medicines.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('℞ Medicines', { underline: true });
        doc.moveDown(0.3);

        medicines.forEach((med, index) => {
          const name = med.medicine_name || med.medicineName || 'Unknown';
          const dosage = med.dosage || '';
          const frequency = med.frequency || '';
          const duration = med.duration || '';
          const qty = med.quantity ? `Qty: ${med.quantity}` : '';
          const instructions = med.instructions || '';
          const beforeFood = med.before_food ? '🍽 Before food' : '';
          const isCritical = med.is_critical ? '⚠️ CRITICAL' : '';

          doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${name}`, { continued: isCritical ? true : false });
          if (isCritical) {
            doc.font('Helvetica-Bold').fillColor('#dc2626').text(`  ${isCritical}`).fillColor('#000000');
          }

          const details = [dosage, frequency, duration, qty].filter(Boolean).join('  |  ');
          if (details) {
            doc.fontSize(9).font('Helvetica').text(`   ${details}`);
          }

          const extras = [instructions, beforeFood].filter(Boolean).join('  •  ');
          if (extras) {
            doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6b7280').text(`   ${extras}`).fillColor('#000000');
          }

          if (med.generic_name) {
            doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(`   Generic: ${med.generic_name}`).fillColor('#000000');
          }

          doc.moveDown(0.2);
        });
      }

      doc.moveDown(0.3);

      // ==================== Advice Sections ====================
      if (prescription.dietary_advice) {
        doc.fontSize(10).font('Helvetica-Bold').text('Dietary Advice:');
        doc.fontSize(9).font('Helvetica').text(prescription.dietary_advice);
        doc.moveDown(0.3);
      }

      if (prescription.lifestyle_advice) {
        doc.fontSize(10).font('Helvetica-Bold').text('Lifestyle Advice:');
        doc.fontSize(9).font('Helvetica').text(prescription.lifestyle_advice);
        doc.moveDown(0.3);
      }

      if (prescription.notes) {
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
        doc.fontSize(9).font('Helvetica').text(prescription.notes);
        doc.moveDown(0.3);
      }

      if (prescription.follow_up_date) {
        const followUp = new Date(prescription.follow_up_date).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        doc.fontSize(10).font('Helvetica-Bold').text(`Follow-up: ${followUp}`);
        doc.moveDown(0.3);
      }

      // ==================== Footer ====================
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke('#d1d5db');
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
        .text('This is a digitally generated prescription from Swastik Healthcare.', { align: 'center' })
        .text('Please verify with your doctor before use.', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = { generatePrescriptionPdf };
