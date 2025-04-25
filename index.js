#!/usr/bin/env node

import express from 'express';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import http from 'http';
import { Server } from 'socket.io';
import open from 'open';
import sharp from 'sharp';
import path from 'path';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Handle command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: crop-folder <folder-path>');
  process.exit(1);
}

const targetFolder = resolve(args[0]);

// Check if folder exists
try {
  const stat = await fs.stat(targetFolder);
  if (!stat.isDirectory()) {
    console.error(`Error: ${targetFolder} is not a directory`);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${targetFolder} does not exist`);
  process.exit(1);
}

// Create the cropped subfolder if it doesn't exist
const croppedFolder = join(targetFolder, 'cropped');
if (!existsSync(croppedFolder)) {
  try {
    mkdirSync(croppedFolder);
    console.log(`Created subfolder: ${croppedFolder}`);
  } catch (err) {
    console.error(`Error creating cropped subfolder: ${err.message}`);
    process.exit(1);
  }
}

// Store the list of image files
let imageFiles = [];
let currentImageIndex = 0;

// Get all image files from the folder
async function loadImageFiles() {
  const files = await fs.readdir(targetFolder);
  
  // Filter for image files only
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  imageFiles = files.filter(file => {
    const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  });
  
  if (imageFiles.length === 0) {
    console.error('No image files found in the specified folder');
    process.exit(1);
  }
  
  console.log(`Found ${imageFiles.length} image files`);
}

// Set up routes
app.use(express.static(join(__dirname, 'public')));
app.use('/images', express.static(targetFolder));

app.get('/api/images', (req, res) => {
  res.json({ 
    images: imageFiles,
    currentIndex: currentImageIndex
  });
});

app.get('/api/current', (req, res) => {
  if (imageFiles.length === 0) {
    return res.status(404).json({ error: 'No images found' });
  }
  
  res.json({ 
    filename: imageFiles[currentImageIndex],
    index: currentImageIndex,
    total: imageFiles.length
  });
});

// Get orientation metadata for the current image
app.get('/api/orientation', async (req, res) => {
  if (imageFiles.length === 0) {
    return res.status(404).json({ error: 'No images found' });
  }
  
  try {
    const filename = imageFiles[currentImageIndex];
    const filepath = join(targetFolder, filename);
    
    // Get image metadata
    const imageInfo = await sharp(filepath).metadata();
    
    let orientationAngle = 0;
    
    // Translate EXIF orientation to degrees
    // See: http://sylvana.net/jpegcrop/exif_orientation.html
    switch (imageInfo.orientation) {
      case 3: // 180 degree rotation
        orientationAngle = 180;
        break;
      case 6: // 90 degree rotation clockwise
        orientationAngle = 90;
        break;
      case 8: // 270 degree rotation clockwise (90 counter-clockwise)
        orientationAngle = -90;
        break;
      // Add other cases if needed
    }
    
    res.json({
      width: imageInfo.width,
      height: imageInfo.height,
      orientation: imageInfo.orientation,
      orientationAngle: orientationAngle,
      format: imageInfo.format
    });
  } catch (err) {
    console.error('Error getting image metadata:', err);
    res.status(500).json({ error: err.message });
  }
});

// Check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Generate a unique filename
async function generateUniqueFilename(baseFilename, extension) {
  let counter = 1;
  let filename = `${baseFilename}${extension}`;
  let filePath = join(croppedFolder, filename);
  
  while (await fileExists(filePath)) {
    filename = `${baseFilename}_${counter}${extension}`;
    filePath = join(croppedFolder, filename);
    counter++;
  }
  
  return filename;
}

// Socket.io connection for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('next-image', () => {
    if (currentImageIndex < imageFiles.length - 1) {
      currentImageIndex++;
      io.emit('image-changed', { 
        filename: imageFiles[currentImageIndex],
        index: currentImageIndex,
        total: imageFiles.length
      });
    }
  });
  
  socket.on('prev-image', () => {
    if (currentImageIndex > 0) {
      currentImageIndex--;
      io.emit('image-changed', { 
        filename: imageFiles[currentImageIndex],
        index: currentImageIndex,
        total: imageFiles.length
      });
    }
  });
  
  // Handle single crop operation (legacy support)
  socket.on('crop-image', async (data) => {
    try {
      const { x, y, width, height, angle } = data;
      const filename = imageFiles[currentImageIndex];
      const filepath = join(targetFolder, filename);
      
      // Get image metadata including EXIF orientation
      const imageInfo = await sharp(filepath).metadata();
      console.log('Single crop - Image metadata:', {
        width: imageInfo.width,
        height: imageInfo.height,
        orientation: imageInfo.orientation,
        format: imageInfo.format
      });
      
      const fileExt = path.extname(filename);
      const baseFilename = path.basename(filename, fileExt);
      
      // Generate a unique filename
      const outputFilename = await generateUniqueFilename(baseFilename, fileExt);
      const outputPath = join(croppedFolder, outputFilename);
      
      // Create a base sharp instance that automatically rotates based on EXIF
      let baseSharpInstance = sharp(filepath).rotate(); // No args = auto-rotate based on EXIF
      
      // If we're applying additional rotation, do it after auto-rotation
      if (angle && angle !== 0) {
        baseSharpInstance = baseSharpInstance.rotate(angle, {
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      }
      
      // Get dimensions after any rotation has been applied
      const processedBuffer = await baseSharpInstance.toBuffer();
      const processedInfo = await sharp(processedBuffer).metadata();
      
      const imageWidth = processedInfo.width;
      const imageHeight = processedInfo.height;
      
      console.log('Single crop - Dimensions after rotation:', { imageWidth, imageHeight });
      
      // Ensure crop area is within image bounds
      const cropX = Math.max(0, x);
      const cropY = Math.max(0, y);
      const cropWidth = Math.min(imageWidth - cropX, width);
      const cropHeight = Math.min(imageHeight - cropY, height);
      
      // Check if crop dimensions are valid
      if (cropWidth <= 0 || cropHeight <= 0) {
        throw new Error('Invalid crop dimensions. The crop area is outside the image bounds.');
      }
      
      // Log crop info for debugging
      console.log('Single crop info:', {
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
        imageWidth,
        imageHeight
      });
      
      // Create a new sharp instance from our processed buffer
      let sharpInstance = sharp(processedBuffer);
      
      // Perform the crop operation
      await sharpInstance
        .extract({ left: cropX, top: cropY, width: cropWidth, height: cropHeight })
        .toFile(outputPath);
      
      // Send success response
      socket.emit('crop-success', { message: `Saved to cropped/${outputFilename}` });
      console.log(`Successfully cropped to ${outputPath}`);
    } catch (err) {
      console.error('Error cropping image:', err);
      socket.emit('crop-error', { error: err.message });
    }
  });
  
  // Handle multiple crop operations
  socket.on('crop-multiple', async (data) => {
    try {
      const { crops, angle, filename, globalName } = data;
      
      if (!crops || crops.length === 0) {
        throw new Error('No crop regions defined');
      }
      
      const filepath = join(targetFolder, filename);
      const fileExt = path.extname(filename);
      const results = [];
      
      // Get image metadata including EXIF orientation
      const imageInfo = await sharp(filepath).metadata();
      console.log('Image metadata:', {
        width: imageInfo.width,
        height: imageInfo.height,
        orientation: imageInfo.orientation,
        format: imageInfo.format
      });
      
      // Create a base sharp instance that automatically rotates based on EXIF
      let baseSharpInstance = sharp(filepath).rotate(); // No args = auto-rotate based on EXIF
      
      // If we're applying additional rotation, do it after auto-rotation
      if (angle && angle !== 0) {
        baseSharpInstance = baseSharpInstance.rotate(angle, {
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      }
      
      // Get dimensions after any rotation has been applied
      const processedBuffer = await baseSharpInstance.toBuffer();
      const processedInfo = await sharp(processedBuffer).metadata();
      
      const imageWidth = processedInfo.width;
      const imageHeight = processedInfo.height;
      
      console.log('Dimensions after rotation:', { imageWidth, imageHeight });
      
      // Track sub-names to avoid duplicates
      const usedSubNames = new Map();
      
      // Process each crop
      for (let i = 0; i < crops.length; i++) {
        const crop = crops[i];
        
        // Generate base filename using metadata
        const subName = crop.subName || (crop.index + 1);
        const description = crop.description ? `_${crop.description.replace(/\s+/g, '_')}` : '';
        
        // Check if this sub-name has been used before
        let uniqueSubName = subName;
        if (usedSubNames.has(subName)) {
          const count = usedSubNames.get(subName) + 1;
          uniqueSubName = `${subName}_${count}`;
          usedSubNames.set(subName, count);
        } else {
          usedSubNames.set(subName, 1);
        }
        
        // Create base filename
        let baseFilename = `${globalName}_${uniqueSubName}${description}`;
        
        // Generate a unique filename to avoid overwriting
        const outputFilename = await generateUniqueFilename(baseFilename, fileExt);
        const outputPath = join(croppedFolder, outputFilename);
        
        // Ensure crop area is within image bounds
        const cropX = Math.max(0, crop.x);
        const cropY = Math.max(0, crop.y);
        const cropWidth = Math.min(imageWidth - cropX, crop.width);
        const cropHeight = Math.min(imageHeight - cropY, crop.height);
        
        // Check if crop dimensions are valid
        if (cropWidth <= 0 || cropHeight <= 0) {
          console.error(`Invalid crop dimensions for crop ${i+1}: ${JSON.stringify({
            original: crop,
            adjusted: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
          })}`);
          continue; // Skip this crop and proceed to the next one
        }
        
        // Log crop info for debugging
        console.log(`Crop ${i+1} info:`, {
          x: cropX,
          y: cropY,
          width: cropWidth,
          height: cropHeight,
          imageWidth,
          imageHeight
        });
        
        // Create a new sharp instance from our processed buffer
        let sharpInstance = sharp(processedBuffer);
        
        // Perform the crop operation
        await sharpInstance
          .extract({ 
            left: cropX, 
            top: cropY, 
            width: cropWidth, 
            height: cropHeight 
          })
          .toFile(outputPath);
        
        results.push(outputFilename);
        console.log(`Created crop: ${outputFilename}`);
      }
      
      // Send success response
      socket.emit('crop-success', { 
        message: `${results.length} crops saved to cropped/ folder` 
      });
    } catch (err) {
      console.error('Error processing multiple crops:', err);
      socket.emit('crop-error', { error: err.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Load image files and start the server
await loadImageFiles();

const PORT = 3000;
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Server running at ${url}`);
  open(url);
}); 