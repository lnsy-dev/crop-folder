# Crop Folder

A powerful Node.js application that helps you batch crop images in a folder through a web interface. Perfect for processing scans, photos, or any collection of images.

## Features

- Browse through images in a folder
- Interactive crop box with resizable handles
- Support for multiple crop regions per image
- Custom file naming with metadata
- Rotate images before cropping
- Real-time crop dimensions display
- Save cropped images to a dedicated subfolder
- Automatic EXIF orientation detection
- Navigate through all images in the folder

## Requirements

- Node.js 14.x or higher
- npm (Node Package Manager)
- Modern web browser

## Installation

### Option 1: Clone the Repository

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/crop-folder.git
   cd crop-folder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Make the script executable:
   ```bash
   chmod +x index.js
   ```

4. Install globally (optional):
   ```bash
   npm link
   ```

### Option 2: Manual Installation

1. Create a new directory:
   ```bash
   mkdir crop-folder
   cd crop-folder
   ```

2. Download or copy all the files from this repository into the directory

3. Install dependencies:
   ```bash
   npm install
   ```

4. Make the script executable:
   ```bash
   chmod +x index.js
   ```

5. Install globally (optional):
   ```bash
   npm link
   ```

## Usage

### Running the Application

After installation, you can run the application in one of two ways:

1. If installed globally with `npm link`:
   ```bash
   crop-folder /path/to/your/images
   ```

2. Using the local script:
   ```bash
   ./crop-folder/index.js /path/to/your/images
   ```

3. Using Node.js directly:
   ```bash
   node crop-folder/index.js /path/to/your/images
   ```

This will:
1. Start a local web server on port 3000
2. Open a browser window with the cropping interface
3. Create a 'cropped' subfolder in your image folder to store the results

### Cropping Images

1. Navigate through images using the "Previous" and "Next" buttons
2. Set a "Global Name" that will be applied to all crops (defaults to the original filename)
3. Add crop regions:
   - Add multiple regions with the "+ Add Crop" button
   - Select a region by clicking on it
   - Resize a region by dragging its corner handles
   - Reposition a region by dragging its center
   - Remove the selected region with "- Remove Selected"
4. Customize each crop:
   - Set a "Sub-Name" for the currently selected crop region
   - Add an optional "Description" for the currently selected crop
5. Rotate the image if needed using the rotation slider
   - Note: The app automatically detects EXIF orientation if present
   - You can reset rotation to 0° with the "Reset" button
6. Click the "Crop All" button to process all crop regions
7. Cropped images will be saved to the 'cropped' subfolder

### Output Files

The cropped images will be saved with the following naming convention:
```
[Global Name]_[Sub-Name]_[Description].[extension]
```

For example:
```
sunset_1_closeup.jpg
sunset_2_wide_angle.jpg
```

If multiple crops have the same name, a counter suffix is automatically added to prevent overwriting.

## Troubleshooting

### Common Issues

1. **"Error: extract_area: bad extract area"**
   - This usually happens when a crop area is outside the image bounds
   - Try making smaller crop selections or reposition them within the image

2. **Image appears rotated incorrectly**
   - The app should auto-detect EXIF orientation
   - If this doesn't work, use the rotation slider to correct it

3. **"No image files found in the specified folder"**
   - Check that the folder contains supported image formats (JPG, PNG, GIF, WEBP)

4. **Permission errors**
   - Make sure you have read/write permissions for the target folder
   - Try running with sudo if necessary (not recommended)

### Command Not Found

If you get a "command not found" error when using the global command:

1. Check that npm link completed successfully
2. Verify that your npm global bin directory is in your PATH
3. Try using the local script or Node.js directly as described above

## Technical Details

This application uses:
- Express.js for the web server
- Socket.io for real-time communication
- Sharp for image processing (cropping and rotation)
- Modern JavaScript with ES modules
- HTML5 and CSS3 for the user interface

## License

MIT License - Feel free to use, modify, and distribute this code. 