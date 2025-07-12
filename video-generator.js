const puppeteer = require('puppeteer');
const { createCanvas, loadImage } = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

class HTMLVideoGenerator {
  constructor(options = {}) {
    this.fps = options.fps || 30;
    this.quality = options.quality || 'high';
    this.outputDir = options.outputDir || './output';
    this.tempDir = options.tempDir || './temp';
  }

  async initialize() {
    // Create output directories
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // Launch headless browser
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
  }

  async generateVideo(htmlFilePath, outputVideoPath, options = {}) {
    const {
      width = 1080,
      height = 1920,
      duration = 15000, // 15 seconds
      framerate = this.fps
    } = options;

    console.log(`🎬 Generating video: ${outputVideoPath}`);
    console.log(`📐 Resolution: ${width}x${height}`);
    console.log(`⏱️ Duration: ${duration}ms at ${framerate}fps`);

    // Create new page
    const page = await this.browser.newPage();
    
    // Set viewport to exact output dimensions
    await page.setViewport({
      width: width,
      height: height,
      deviceScaleFactor: 2 // High DPI for better quality
    });

    // Load HTML file
    const htmlPath = path.resolve(htmlFilePath);
    await page.goto(`file://${htmlPath}`);
    
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Calculate frame timing
    const frameInterval = 1000 / framerate;
    const totalFrames = Math.ceil(duration / frameInterval);
    
    console.log(`📸 Capturing ${totalFrames} frames...`);

    // Capture frames
    const framePromises = [];
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i * frameInterval;
      
      framePromises.push(
        this.captureFrame(page, i, timestamp, width, height)
      );
      
      // Process in batches to avoid memory issues
      if (framePromises.length >= 10) {
        await Promise.all(framePromises);
        framePromises.length = 0;
        console.log(`📸 Captured frame ${i + 1}/${totalFrames}`);
      }
    }
    
    // Process remaining frames
    if (framePromises.length > 0) {
      await Promise.all(framePromises);
    }

    await page.close();

    // Convert frames to video
    await this.framesToVideo(totalFrames, outputVideoPath, framerate);
    
    // Cleanup temp files
    await this.cleanup();
    
    console.log(`✅ Video generated: ${outputVideoPath}`);
  }

  async captureFrame(page, frameIndex, timestamp, width, height) {
    // Wait for the specific timestamp
    await new Promise(resolve => setTimeout(resolve, timestamp > 0 ? 33 : 0)); // ~30fps timing
    
    // Capture screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: width,
        height: height
      }
    });
    
    // Save frame to temp directory
    const framePath = path.join(this.tempDir, `frame_${frameIndex.toString().padStart(6, '0')}.png`);
    await fs.writeFile(framePath, screenshot);
    
    return framePath;
  }

  async framesToVideo(totalFrames, outputPath, framerate) {
    console.log(`🎞️ Converting ${totalFrames} frames to video...`);
    
    return new Promise((resolve, reject) => {
      const inputPattern = path.join(this.tempDir, 'frame_%06d.png');
      
      ffmpeg()
        .input(inputPattern)
        .inputFPS(framerate)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-crf 18', // High quality
          '-preset slow', // Better compression
          '-movflags +faststart' // Web optimization
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('🚀 FFmpeg started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log(`📊 Processing: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log('✅ Video conversion completed');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.unlink(path.join(this.tempDir, file));
        }
      }
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Usage example
async function main() {
  const generator = new HTMLVideoGenerator({
    fps: 30,
    outputDir: './videos',
    tempDir: './temp-frames'
  });

  try {
    await generator.initialize();
    
    // Generate video from your HTML file
    await generator.generateVideo(
      './your-quiz.html', // ⚠️ CHANGE THIS to your actual HTML file name
      './videos/biology-quiz-vertical.mp4',
      {
        width: 1080,   // TikTok/Instagram Stories width
        height: 1920,  // TikTok/Instagram Stories height
        duration: 15000, // 15 seconds
        framerate: 30
      }
    );
    
    console.log('✅ All videos generated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await generator.close();
  }
}

// Batch processing function
async function batchGenerate(htmlFiles) {
  const generator = new HTMLVideoGenerator();
  await generator.initialize();
  
  for (const [index, htmlFile] of htmlFiles.entries()) {
    try {
      await generator.generateVideo(
        htmlFile,
        `./videos/quiz-${index + 1}.mp4`,
        {
          width: 1080,
          height: 1920,
          duration: 15000,
          framerate: 30
        }
      );
    } catch (error) {
      console.error(`❌ Failed to process ${htmlFile}:`, error);
    }
  }
  
  await generator.close();
}

// Export for use in other scripts
module.exports = { HTMLVideoGenerator, batchGenerate };

// Run if called directly
if (require.main === module) {
  main();
}