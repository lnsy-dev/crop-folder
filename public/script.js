// Connect to the Socket.io server
const socket = io();

// DOM elements
const cropperContainer = document.getElementById('cropperContainer');
const cropBoxContainer = document.getElementById('cropBoxContainer');
const currentImage = document.getElementById('currentImage');
const cropBtn = document.getElementById('cropBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const imageCounter = document.getElementById('imageCounter');
const cropDimensions = document.getElementById('cropDimensions');
const messageEl = document.getElementById('message');
const rotationAngle = document.getElementById('rotationAngle');
const rotationValue = document.getElementById('rotationValue');
const resetRotationBtn = document.getElementById('resetRotationBtn');
const addCropBtn = document.getElementById('addCropBtn');
const deleteCropBtn = document.getElementById('deleteCropBtn');
const selectedCropIndex = document.getElementById('selectedCropIndex');
const globalNameInput = document.getElementById('globalName');
const subNameInput = document.getElementById('subName');
const descriptionInput = document.getElementById('description');
const filePreview = document.getElementById('filePreview');
const filenamePreview = document.getElementById('filenamePreview');
const outputPath = document.getElementById('outputPath');
const orientationIndicator = document.getElementById('orientationIndicator');
const orientationAngleEl = document.getElementById('orientationAngle');

// State variables
let isDragging = false;
let isResizing = false;
let currentResizeHandle = '';
let startX, startY, startWidth, startHeight, startLeft, startTop;
let imageData = { filename: '', index: 0, total: 0 };
let currentRotation = 0;
let cropBoxes = [];
let selectedCropBoxId = null;

// Initialize the application
async function init() {
  try {
    // Fetch initial image data
    const response = await fetch('/api/current');
    if (!response.ok) {
      throw new Error('Failed to fetch initial image data');
    }
    
    imageData = await response.json();
    updateImageDisplay();
    
    // Initialize event listeners
    setupEventListeners();
    
    // Add initial crop box
    addCropBox();
    
    // Initialize global name from filename
    if (imageData.filename) {
      const baseName = getBaseFileName(imageData.filename);
      if (!globalNameInput.value) {
        globalNameInput.value = baseName;
      }
    }
    
    // Update file preview
    updateFilePreview();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

// Extract base filename without extension
function getBaseFileName(filename) {
  return filename.substring(0, filename.lastIndexOf('.'));
}

// Reset crop box when a new image is loaded
function resetCropBox() {
  // Wait for image to be fully loaded
  const imgWidth = currentImage.offsetWidth;
  const imgHeight = currentImage.offsetHeight;
  
  // Set crop box to a more conservative size (30% of image), centered
  const boxWidth = Math.min(imgWidth * 0.3, 300);
  const boxHeight = Math.min(imgHeight * 0.3, 300);
  
  cropBox.style.width = `${boxWidth}px`;
  cropBox.style.height = `${boxHeight}px`;
  cropBox.style.left = `${(imgWidth - boxWidth) / 2}px`;
  cropBox.style.top = `${(imgHeight - boxHeight) / 2}px`;
  
  updateCropDimensions();
}

// Reset crop boxes when a new image is loaded
function resetCropBoxes() {
  // Clear existing crop boxes
  cropBoxContainer.innerHTML = '';
  cropBoxes = [];
  selectedCropBoxId = null;
  
  // Add a new crop box, but wait for the image to be fully loaded
  setTimeout(() => {
    if (currentImage.complete) {
      addCropBox();
    } else {
      currentImage.addEventListener('load', addCropBox, { once: true });
    }
  }, 100);
}

// Create a new crop box
function addCropBox() {
  const imgWidth = currentImage.offsetWidth;
  const imgHeight = currentImage.offsetHeight;
  
  // If image dimensions are zero, wait and try again
  if (imgWidth === 0 || imgHeight === 0) {
    setTimeout(addCropBox, 100);
    return;
  }
  
  // Create unique ID for this crop box
  const id = `crop-box-${Date.now()}`;
  
  // Create crop box element
  const cropBox = document.createElement('div');
  cropBox.className = 'crop-box';
  cropBox.id = id;
  cropBox.dataset.index = cropBoxes.length;
  
  // Position in the center or offset if there are existing boxes
  // Use a more conservative size (30% of image)
  const boxWidth = Math.min(imgWidth * 0.3, 200);
  const boxHeight = Math.min(imgHeight * 0.3, 200);
  
  let left = (imgWidth - boxWidth) / 2;
  let top = (imgHeight - boxHeight) / 2;
  
  // Offset new boxes slightly if others exist
  if (cropBoxes.length > 0) {
    // Calculate a more intelligent offset to stay within the image bounds
    const offsetX = Math.min(20, imgWidth * 0.05);
    const offsetY = Math.min(20, imgHeight * 0.05);
    
    left += offsetX * cropBoxes.length;
    top += offsetY * cropBoxes.length;
    
    // Make sure it's still visible within the image bounds
    left = Math.min(left, imgWidth - boxWidth - 10);
    top = Math.min(top, imgHeight - boxHeight - 10);
  }
  
  // Ensure we never go outside the image bounds
  left = Math.max(0, Math.min(left, imgWidth - boxWidth));
  top = Math.max(0, Math.min(top, imgHeight - boxHeight));
  
  cropBox.style.width = `${boxWidth}px`;
  cropBox.style.height = `${boxHeight}px`;
  cropBox.style.left = `${left}px`;
  cropBox.style.top = `${top}px`;
  
  // Add label
  const label = document.createElement('div');
  label.className = 'crop-box-label';
  label.textContent = `Crop ${cropBoxes.length + 1}`;
  cropBox.appendChild(label);
  
  // Add resize handles
  addResizeHandles(cropBox);
  
  // Add to DOM
  cropBoxContainer.appendChild(cropBox);
  
  // Store reference
  cropBoxes.push({
    id,
    element: cropBox,
    index: cropBoxes.length
  });
  
  // Select the new crop box
  selectCropBox(id);
  
  // Add event listeners
  cropBox.addEventListener('mousedown', (e) => {
    // Select this crop box
    selectCropBox(id);
    
    // Start dragging if it's not a resize handle
    if (!e.target.classList.contains('resize-handle')) {
      startDrag(e);
    }
  });
  
  const resizeHandles = cropBox.querySelectorAll('.resize-handle');
  resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', startResize);
  });
  
  // Update the filename preview
  updateFilePreview();
  
  return cropBox;
}

// Add resize handles to a crop box
function addResizeHandles(cropBox) {
  const positions = ['nw', 'ne', 'sw', 'se'];
  
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.setAttribute('data-position', pos);
    cropBox.appendChild(handle);
  });
}

// Select a crop box
function selectCropBox(id) {
  // Remove selected class from all crop boxes
  document.querySelectorAll('.crop-box').forEach(box => {
    box.classList.remove('selected');
  });
  
  // Add selected class to the selected crop box
  const selectedBox = document.getElementById(id);
  if (selectedBox) {
    selectedBox.classList.add('selected');
    selectedCropBoxId = id;
    
    // Update selected index display
    const boxIndex = selectedBox.dataset.index;
    selectedCropIndex.textContent = `Crop ${parseInt(boxIndex) + 1}`;
    
    // Update subname input with crop index if empty
    if (!subNameInput.value) {
      subNameInput.value = `${parseInt(boxIndex) + 1}`;
    }
    
    // Update dimensions display
    updateCropDimensions();
  } else {
    selectedCropBoxId = null;
    selectedCropIndex.textContent = 'None';
  }
}

// Remove the selected crop box
function deleteCropBox() {
  if (!selectedCropBoxId) return;
  
  const selectedBox = document.getElementById(selectedCropBoxId);
  if (!selectedBox) return;
  
  // Remove from DOM
  selectedBox.remove();
  
  // Remove from array
  const index = cropBoxes.findIndex(box => box.id === selectedCropBoxId);
  if (index !== -1) {
    cropBoxes.splice(index, 1);
  }
  
  // Update indices
  document.querySelectorAll('.crop-box').forEach((box, i) => {
    box.dataset.index = i;
    box.querySelector('.crop-box-label').textContent = `Crop ${i + 1}`;
  });
  
  // Update cropBoxes array
  cropBoxes = cropBoxes.map((box, i) => {
    box.index = i;
    return box;
  });
  
  // Select another box if available
  if (cropBoxes.length > 0) {
    selectCropBox(cropBoxes[0].id);
  } else {
    selectedCropBoxId = null;
    selectedCropIndex.textContent = 'None';
  }
  
  // Update the filename preview
  updateFilePreview();
}

// Update preview of output files
function updateFilePreview() {
  if (cropBoxes.length === 0 || !imageData.filename) {
    filePreview.classList.add('hidden');
    return;
  }
  
  // Show the preview
  filePreview.classList.remove('hidden');
  
  // Clear previous preview
  filenamePreview.innerHTML = '';
  
  // Get file extension
  const fileExt = imageData.filename.substring(imageData.filename.lastIndexOf('.'));
  
  // Track sub-names to ensure uniqueness in the preview
  const usedSubNames = new Map();
  
  // For each crop box, generate a preview
  cropBoxes.forEach((box, index) => {
    const cropNum = index + 1;
    const globalName = globalNameInput.value || getBaseFileName(imageData.filename);
    const subName = subNameInput.value || cropNum;
    const description = descriptionInput.value ? `_${descriptionInput.value.replace(/\s+/g, '_')}` : '';
    
    // Check if this sub-name has been used before
    let uniqueSubName = subName;
    if (usedSubNames.has(subName)) {
      const count = usedSubNames.get(subName) + 1;
      uniqueSubName = `${subName}_${count}`;
      usedSubNames.set(subName, count);
    } else {
      usedSubNames.set(subName, 1);
    }
    
    const filename = `${globalName}_${uniqueSubName}${description}${fileExt}`;
    
    const previewItem = document.createElement('div');
    previewItem.className = 'filename-item';
    previewItem.textContent = filename;
    filenamePreview.appendChild(previewItem);
  });
}

// Set up event listeners
function setupEventListeners() {
  // Document-level events for dragging and resizing
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  
  // Button events
  cropBtn.addEventListener('click', cropAllImages);
  prevBtn.addEventListener('click', previousImage);
  nextBtn.addEventListener('click', nextImage);
  addCropBtn.addEventListener('click', addCropBox);
  deleteCropBtn.addEventListener('click', deleteCropBox);
  
  // Rotation events
  rotationAngle.addEventListener('input', updateRotation);
  resetRotationBtn.addEventListener('click', resetRotation);
  
  // Metadata input events
  globalNameInput.addEventListener('input', updateFilePreview);
  subNameInput.addEventListener('input', updateFilePreview);
  descriptionInput.addEventListener('input', updateFilePreview);
  
  // Image load event
  currentImage.addEventListener('load', resetCropBoxes);
  
  // Socket events
  socket.on('image-changed', newImageData => {
    imageData = newImageData;
    updateImageDisplay();
    resetRotation();
  });
  
  socket.on('crop-success', data => {
    showMessage(`Successfully cropped: ${data.message}`, 'success');
  });
  
  socket.on('crop-error', data => {
    showMessage(`Error: ${data.error}`, 'error');
  });
}

// Update the display with current image
function updateImageDisplay() {
  if (!imageData.filename) return;
  
  currentImage.src = `/images/${imageData.filename}`;
  imageCounter.textContent = `Image ${imageData.index + 1} of ${imageData.total}`;
  
  // Enable/disable navigation buttons
  prevBtn.disabled = imageData.index === 0;
  nextBtn.disabled = imageData.index === imageData.total - 1;
  
  // Update global name from filename if empty
  if (!globalNameInput.value) {
    globalNameInput.value = getBaseFileName(imageData.filename);
  }
  
  // Update file preview
  updateFilePreview();
  
  // Fetch and display orientation metadata
  fetchOrientationMetadata();
}

// Fetch orientation metadata for the current image
async function fetchOrientationMetadata() {
  try {
    // Hide the indicator initially
    orientationIndicator.classList.add('hidden');
    
    const response = await fetch('/api/orientation');
    if (!response.ok) {
      throw new Error('Failed to fetch orientation data');
    }
    
    const metadata = await response.json();
    console.log('Image orientation metadata:', metadata);
    
    // Show orientation indicator if there's EXIF orientation
    if (metadata.orientation && metadata.orientation !== 1) {
      orientationAngleEl.textContent = `${metadata.orientationAngle}°`;
      orientationIndicator.classList.remove('hidden');
      
      // Set the rotation slider to match the EXIF orientation
      // But only if the user hasn't set a manual rotation yet
      if (parseInt(rotationAngle.value) === 0) {
        updateRotationUI(metadata.orientationAngle);
      }
    }
  } catch (error) {
    console.error('Error fetching orientation data:', error);
  }
}

// Update the rotation UI without triggering events
function updateRotationUI(angle) {
  rotationAngle.value = angle;
  rotationValue.textContent = `${angle}°`;
  currentImage.style.transform = `rotate(${angle}deg)`;
  currentRotation = angle;
}

// Update the rotation angle
function updateRotation(e) {
  currentRotation = parseInt(rotationAngle.value);
  rotationValue.textContent = `${currentRotation}°`;
  
  // Apply rotation to the image
  currentImage.style.transform = `rotate(${currentRotation}deg)`;
}

// Reset rotation to 0
function resetRotation() {
  rotationAngle.value = 0;
  currentRotation = 0;
  rotationValue.textContent = '0°';
  currentImage.style.transform = 'rotate(0deg)';
}

// Start dragging the crop box
function startDrag(e) {
  if (!selectedCropBoxId) return;
  
  const cropBox = document.getElementById(selectedCropBoxId);
  if (!cropBox) return;
  
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  startLeft = parseInt(window.getComputedStyle(cropBox).left);
  startTop = parseInt(window.getComputedStyle(cropBox).top);
  
  e.preventDefault();
}

// Drag the crop box
function drag(e) {
  if (!isDragging && !isResizing) return;
  
  if (isDragging) {
    if (!selectedCropBoxId) return;
    
    const cropBox = document.getElementById(selectedCropBoxId);
    if (!cropBox) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    const newLeft = Math.max(0, Math.min(startLeft + dx, cropperContainer.offsetWidth - cropBox.offsetWidth));
    const newTop = Math.max(0, Math.min(startTop + dy, cropperContainer.offsetHeight - cropBox.offsetHeight));
    
    cropBox.style.left = `${newLeft}px`;
    cropBox.style.top = `${newTop}px`;
    
    updateCropDimensions();
  } else if (isResizing) {
    if (!selectedCropBoxId) return;
    
    const cropBox = document.getElementById(selectedCropBoxId);
    if (!cropBox) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // Minimum size for crop box
    const minSize = 50;
    
    switch (currentResizeHandle) {
      case 'se':
        const newWidth = Math.max(minSize, startWidth + dx);
        const newHeight = Math.max(minSize, startHeight + dy);
        
        cropBox.style.width = `${Math.min(newWidth, cropperContainer.offsetWidth - startLeft)}px`;
        cropBox.style.height = `${Math.min(newHeight, cropperContainer.offsetHeight - startTop)}px`;
        break;
        
      case 'sw':
        const swWidth = Math.max(minSize, startWidth - dx);
        const swLeft = startLeft + startWidth - swWidth;
        
        if (swLeft >= 0 && swWidth <= startLeft + startWidth) {
          cropBox.style.left = `${swLeft}px`;
          cropBox.style.width = `${swWidth}px`;
        }
        
        cropBox.style.height = `${Math.max(minSize, Math.min(startHeight + dy, cropperContainer.offsetHeight - startTop))}px`;
        break;
        
      case 'ne':
        cropBox.style.width = `${Math.max(minSize, Math.min(startWidth + dx, cropperContainer.offsetWidth - startLeft))}px`;
        
        const neHeight = Math.max(minSize, startHeight - dy);
        const neTop = startTop + startHeight - neHeight;
        
        if (neTop >= 0 && neHeight <= startTop + startHeight) {
          cropBox.style.top = `${neTop}px`;
          cropBox.style.height = `${neHeight}px`;
        }
        break;
        
      case 'nw':
        const nwWidth = Math.max(minSize, startWidth - dx);
        const nwLeft = startLeft + startWidth - nwWidth;
        
        if (nwLeft >= 0 && nwWidth <= startLeft + startWidth) {
          cropBox.style.left = `${nwLeft}px`;
          cropBox.style.width = `${nwWidth}px`;
        }
        
        const nwHeight = Math.max(minSize, startHeight - dy);
        const nwTop = startTop + startHeight - nwHeight;
        
        if (nwTop >= 0 && nwHeight <= startTop + startHeight) {
          cropBox.style.top = `${nwTop}px`;
          cropBox.style.height = `${nwHeight}px`;
        }
        break;
    }
    
    updateCropDimensions();
  }
}

// Stop dragging or resizing
function stopDrag() {
  isDragging = false;
  isResizing = false;
}

// Start resizing the crop box
function startResize(e) {
  if (!e.target.classList.contains('resize-handle')) return;
  
  // First make sure we've selected the parent crop box
  const cropBox = e.target.closest('.crop-box');
  if (!cropBox) return;
  
  selectCropBox(cropBox.id);
  
  isResizing = true;
  currentResizeHandle = e.target.getAttribute('data-position');
  
  startX = e.clientX;
  startY = e.clientY;
  startWidth = parseInt(window.getComputedStyle(cropBox).width);
  startHeight = parseInt(window.getComputedStyle(cropBox).height);
  startLeft = parseInt(window.getComputedStyle(cropBox).left);
  startTop = parseInt(window.getComputedStyle(cropBox).top);
  
  e.stopPropagation();
  e.preventDefault();
}

// Update the crop dimensions display
function updateCropDimensions() {
  if (!selectedCropBoxId) {
    cropDimensions.textContent = '0 × 0';
    return;
  }
  
  const cropBox = document.getElementById(selectedCropBoxId);
  if (!cropBox) return;
  
  const width = Math.round(cropBox.offsetWidth);
  const height = Math.round(cropBox.offsetHeight);
  cropDimensions.textContent = `${width} × ${height}`;
}

// Crop all regions from the current image
function cropAllImages() {
  if (!imageData.filename || cropBoxes.length === 0) {
    showMessage('No image loaded or no crop regions defined', 'error');
    return;
  }
  
  // Get global name, making sure it has a value
  const globalName = globalNameInput.value || getBaseFileName(imageData.filename);
  
  // Collect all crop data
  const cropData = cropBoxes.map(box => {
    const cropBox = document.getElementById(box.id);
    if (!cropBox) return null;
    
    const rect = currentImage.getBoundingClientRect();
    const boxRect = cropBox.getBoundingClientRect();
    
    // Calculate scaling factor between displayed image and actual image
    const naturalWidth = currentImage.naturalWidth;
    const naturalHeight = currentImage.naturalHeight;
    const scaleX = naturalWidth / currentImage.offsetWidth;
    const scaleY = naturalHeight / currentImage.offsetHeight;
    
    const cropNum = parseInt(cropBox.dataset.index) + 1;
    const subName = subNameInput.value || cropNum;
    const description = descriptionInput.value || '';
    
    // Calculate crop coordinates relative to the image
    return {
      x: Math.round((boxRect.left - rect.left) * scaleX),
      y: Math.round((boxRect.top - rect.top) * scaleY),
      width: Math.round(cropBox.offsetWidth * scaleX),
      height: Math.round(cropBox.offsetHeight * scaleY),
      index: parseInt(cropBox.dataset.index),
      subName: subName,
      description: description
    };
  }).filter(crop => crop !== null);
  
  // Send crop data and rotation angle to the server
  socket.emit('crop-multiple', { 
    crops: cropData,
    angle: currentRotation,
    filename: imageData.filename,
    globalName: globalName
  });
  
  // Show loading message
  showMessage('Cropping images...', 'info');
}

// Navigate to the previous image
function previousImage() {
  if (imageData.index > 0) {
    socket.emit('prev-image');
  }
}

// Navigate to the next image
function nextImage() {
  if (imageData.index < imageData.total - 1) {
    socket.emit('next-image');
  }
}

// Show a message to the user
function showMessage(text, type = 'info') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  
  // Hide the message after 3 seconds
  setTimeout(() => {
    messageEl.className = 'message hidden';
  }, 3000);
}

// Initialize the application when the page loads
init(); 