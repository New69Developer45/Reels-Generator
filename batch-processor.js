const { HTMLVideoGenerator } = require('./video-generator');
const fs = require('fs').promises;
const path = require('path');

// Social media presets
const PRESETS = {
  tiktok: { width: 1080, height: 1920, name: 'TikTok' },
  instagram_stories: { width: 1080, height: 1920, name: 'Instagram Stories' },
  youtube_shorts: { width: 1080, height: 1920, name: 'YouTube Shorts' },
  instagram_square: { width: 1080, height: 1080, name: 'Instagram Square' },
  facebook_video: { width: 1080, height: 1350, name: 'Facebook Video' }
};

class BatchVideoProcessor {
  constructor(options = {}) {
    this.generator = new HTMLVideoGenerator(options);
    this.formats = options.formats || ['tiktok', 'instagram_square'];
    this.duration = options.duration || 15000;
    this.framerate = options.framerate || 30;
  }

  async processDirectory(inputDir, outputDir) {
    console.log(`📁 Processing directory: ${inputDir}`);
    
    await this.generator.initialize();
    
    try {
      // Find all HTML files
      const files = await fs.readdir(inputDir);
      const htmlFiles = files.filter(file => file.endsWith('.html'));
      
      console.log(`📄 Found ${htmlFiles.length} HTML files`);
      
      // Process each file
      for (const [index, htmlFile] of htmlFiles.entries()) {
        const inputPath = path.join(inputDir, htmlFile);
        const baseName = path.basename(htmlFile, '.html');
        
        console.log(`\n🔄 Processing ${index + 1}/${htmlFiles.length}: ${htmlFile}`);
        
        // Generate video in each format
        for (const formatName of this.formats) {
          const preset = PRESETS[formatName];
          if (!preset) {
            console.warn(`⚠️ Unknown format: ${formatName}`);
            continue;
          }
          
          const outputPath = path.join(
            outputDir,
            `${baseName}_${formatName}.mp4`
          );
          
          try {
            await this.generator.generateVideo(inputPath, outputPath, {
              width: preset.width,
              height: preset.height,
              duration: this.duration,
              framerate: this.framerate
            });
            
            console.log(`✅ Generated ${preset.name} video: ${outputPath}`);
          } catch (error) {
            console.error(`❌ Failed to generate ${preset.name} video:`, error.message);
          }
        }
      }
      
    } finally {
      await this.generator.close();
    }
  }

  async processQuestionData(questionsFile, templateFile, outputDir) {
    console.log(`📊 Processing questions from: ${questionsFile}`);
    
    // Load questions and template
    const questions = JSON.parse(await fs.readFile(questionsFile, 'utf8'));
    const template = await fs.readFile(templateFile, 'utf8');
    
    await this.generator.initialize();
    
    try {
      for (const [index, question] of questions.entries()) {
        console.log(`\n🔄 Processing question ${index + 1}/${questions.length}`);
        
        // Generate HTML from template
        const html = this.generateHTMLFromTemplate(template, question);
        const tempHtmlPath = path.join(outputDir, `temp_question_${index}.html`);
        await fs.writeFile(tempHtmlPath, html);
        
        // Generate videos in all formats
        for (const formatName of this.formats) {
          const preset = PRESETS[formatName];
          const outputPath = path.join(
            outputDir,
            `question_${index + 1}_${formatName}.mp4`
          );
          
          try {
            await this.generator.generateVideo(tempHtmlPath, outputPath, {
              width: preset.width,
              height: preset.height,
              duration: this.duration,
              framerate: this.framerate
            });
            
            console.log(`✅ Generated ${preset.name}: question_${index + 1}_${formatName}.mp4`);
          } catch (error) {
            console.error(`❌ Failed ${preset.name}:`, error.message);
          }
        }
        
        // Clean up temp HTML
        await fs.unlink(tempHtmlPath);
      }
      
    } finally {
      await this.generator.close();
    }
  }

  generateHTMLFromTemplate(template, questionData) {
    // Simple template replacement
    let html = template;
    
    // Replace placeholders
    html = html.replace(/{{QUESTION_TEXT}}/g, questionData.question);
    html = html.replace(/{{SUBJECT}}/g, questionData.subject || 'BIOLOGY');
    html = html.replace(/{{CORRECT_ANSWER}}/g, questionData.correct);
    html = html.replace(/{{EXPLANATION}}/g, questionData.explanation);
    
    // Replace options
    if (questionData.options) {
      questionData.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C, D
        html = html.replace(
          new RegExp(`{{OPTION_${letter}}}`, 'g'),
          option
        );
      });
    }
    
    return html;
  }
}

// Usage examples
async function main() {
  const processor = new BatchVideoProcessor({
    formats: ['tiktok', 'instagram_square', 'youtube_shorts'],
    duration: 15000,
    framerate: 30
  });
  
  // Method 1: Process existing HTML files
  await processor.processDirectory('./quiz-files', './output-videos');
  
  // Method 2: Process from questions JSON
  // await processor.processQuestionData(
  //   './questions.json',
  //   './template.html',
  //   './output-videos'
  // );
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BatchVideoProcessor, PRESETS };