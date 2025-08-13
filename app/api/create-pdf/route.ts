import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export async function POST(request: NextRequest) {
  try {
    const { bookData, layouts } = await request.json();
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Set metadata
    pdfDoc.setTitle(bookData.title);
    pdfDoc.setAuthor('Us & Then');
    pdfDoc.setSubject(`Baby memory book for ${bookData.babyName}`);
    pdfDoc.setCreationDate(new Date());
    
    // Add pages
    for (const pageData of bookData.pages) {
      const layout = layouts[pageData.page_number];
      if (!layout) continue;
      
      // Create page at 8.5x11 inches (612x792 points)
      const page = pdfDoc.addPage([612, 792]);
      const { width, height } = page.getSize();
      
      // Add text
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const element of layout.elements) {
        if (element.type === 'text') {
          // Scale positions to PDF coordinates
          const x = (element.x / layout.canvas.width) * width;
          const y = height - (element.y / layout.canvas.height) * height;
          
          page.drawText(element.content || '', {
            x,
            y,
            size: element.style?.font_size_pt || 12,
            font,
            color: rgb(0, 0, 0),
            rotate: element.rotation ? degrees(element.rotation) : undefined,
          });
        } else if (element.type === 'image' && element.url) {
          // Fetch and embed image
          try {
            const imageBytes = await fetch(element.url).then(res => res.arrayBuffer());
            const image = await pdfDoc.embedPng(new Uint8Array(imageBytes));
            
            const x = (element.x / layout.canvas.width) * width - element.width / 2;
            const y = height - (element.y / layout.canvas.height) * height - element.height / 2;
            
            page.drawImage(image, {
              x,
              y,
              width: element.width,
              height: element.height,
              rotate: element.rotation ? degrees(element.rotation) : undefined,
            });
          } catch (error) {
            console.error('Failed to embed image:', error);
          }
        }
      }
    }
    
    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    
    // Return as base64
    const base64 = Buffer.from(pdfBytes).toString('base64');
    
    return NextResponse.json({ 
      success: true, 
      pdf: base64,
      pages: pdfDoc.getPageCount()
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}