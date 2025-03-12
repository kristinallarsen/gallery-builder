let viewer;
let collectedManifests = []; // This will hold the individual manifests

document.addEventListener('DOMContentLoaded', () => {
  viewer = OpenSeadragon({
    id: 'viewer',
    prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.0.0/images/',
    tileSources: []
  });
});


// Clear current gallery and add images from loaded collection
function repopulateGallery(manifestData) {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = ''; // Clear the current gallery

  // Check if items array exists
  const manifests = manifestData.items; // Update based on IIIF spec

  if (!Array.isArray(manifests)) {
    console.error('No valid items found in the manifest data.');
    return;
  }

  manifests.forEach(manifest => {
    // Access the sequences within each manifest
    if (manifest.sequences && manifest.sequences.length > 0) {
      const canvasItems = manifest.sequences[0].canvases;
      canvasItems.forEach(canvas => {
        addCanvasToGallery(canvas, manifest); // A new function to handle adding canvases
      });
    } else {
      console.error('Manifest does not contain valid sequences.');
    }
  });
}

function getMetadataValue(metadata, label, getLast = false) {
  const items = metadata.filter(item => item.label === label);
  
  if (getLast && items.length > 0) {
      const lastItem = items[items.length - 1]; // Get the last instance found
      if (Array.isArray(lastItem.value)) {
          return lastItem.value[0]; // Return the first value of the array (Digital Commonwealth)
      }
      return lastItem.value; // Return the value directly if it's not an array
  }

  return items.length > 0 ? items[0].value : null; // Return the first instance or null
}

function isAbsoluteURL(url) {
  return /^(http|https):\/\//i.test(url);
}

function addCanvasToGallery(canvas, manifest) {
  const imageService = canvas.images[0].resource.service;

  if (!imageService || !imageService['@id']) {
      console.error('Image service is missing or does not contain an @id field:', canvas);
      return;
  }

  const imageUrl = `${imageService['@id']}/full/!200,200/0/default.jpg`;
  const highResUrl = `${imageService['@id']}/info.json`;

  // Retrieve metadata from both the manifest and the canvas
  const manifestMetadata = manifest.metadata || [];    
  const canvasMetadata = canvas.metadata || [];

  console.log('Manifest Metadata:', manifestMetadata);
  console.log('Canvas Metadata:', canvasMetadata);

  // Attempt to get title, date and author
  let title = getMetadataValue(canvasMetadata, 'Title') || getMetadataValue(manifestMetadata, 'Title') || manifest.label || 'No title returned';
  let date = getMetadataValue(canvasMetadata, 'Date') || getMetadataValue(manifestMetadata, 'Date') || getMetadataValue(manifestMetadata, 'Created Published') || 'No date returned';
  let author = getMetadataValue(canvasMetadata, 'Creator') || getMetadataValue(manifestMetadata, 'Creator') || getMetadataValue(canvasMetadata, 'Contributors') || getMetadataValue(manifestMetadata, 'Contributors') || getMetadataValue(canvasMetadata, 'Author') || getMetadataValue(manifestMetadata, 'Author') || getMetadataValue(canvasMetadata, 'Contributor') || getMetadataValue(manifestMetadata, 'Contributor') || 'No author returned';
  
// Get the location link
let locationLink = null;

// Check for a valid URL in the related field, considering both formats
if (manifest.related) {
    // If related is an object and has an @id
    if (typeof manifest.related === 'object' && manifest.related["@id"]) {
        locationLink = manifest.related["@id"];
    } 
    // If it's a string, use that directly
    else if (typeof manifest.related === 'string') {
        locationLink = manifest.related;
    }
}

// If locationLink is still not defined, check other sources
if (!locationLink) {
    locationLink = getMetadataValue(canvasMetadata, 'Identifier') || 
                   getMetadataValue(manifestMetadata, 'Identifier', true) || // Get last occurrence
                   getMetadataValue(canvasMetadata, 'Item Url') || // LOC label
                   getMetadataValue(manifestMetadata, 'Item Url') || // covering canvas and manifest metadata sources
                   'No link available';
}

// Debugging logs for verification
console.log('Location Link:', locationLink);

// Ensure the link is absolute
if (!isAbsoluteURL(locationLink) && locationLink !== 'No link available') {
  locationLink = 'http://' + locationLink; // Adjust based on your needs
}

  // Get collection name and attribution
  let collection = getMetadataValue(canvasMetadata, 'Location') || getMetadataValue(manifestMetadata, 'Location') || 'No collection returned';
  const attribution = manifest.attribution || 'No attribution returned';

  const card = document.createElement('div');
  card.className = 'card';

  const img = document.createElement('img');
  img.src = imageUrl;

  img.addEventListener('click', () => {
      viewer.open(highResUrl);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = 'x';
  deleteBtn.addEventListener('click', () => {
      const shouldRemove = confirm('Do you want to remove this image from the gallery?');
      if (shouldRemove) {
          card.remove();
      }
  });

  const titleEl = document.createElement('p');
  titleEl.textContent = `Title: ${title}`;

  const authorEl = document.createElement('p');
  authorEl.textContent = `Author: ${author}`;

  const dateEl = document.createElement('p');
  dateEl.textContent = `Date: ${date}`;

  const collectionEl = document.createElement('p');
  collectionEl.textContent = `Collection: ${collection}`;

  const attributionEl = document.createElement('p');
  attributionEl.textContent = `Attribution: ${attribution}`;

  // Link to the item's location
  const locationLinkEl = document.createElement('a');
  locationLinkEl.href = locationLink === 'No link available' ? '#' : locationLink; // Link to '#' if no link
  locationLinkEl.textContent = 'View Item';
  locationLinkEl.target = '_blank'; // Opens in a new tab

  const locationParagraph = document.createElement('p');
  locationParagraph.appendChild(locationLinkEl);

  card.appendChild(deleteBtn);
  card.appendChild(img);
  card.appendChild(titleEl);
  card.appendChild(authorEl);
  card.appendChild(dateEl);
  card.appendChild(collectionEl);
  card.appendChild(attributionEl);
  card.appendChild(locationParagraph);  // Add the link to the card

  document.getElementById('gallery').appendChild(card);
}

// Function to add a IIIF manifest to the gallery
async function addManifestToGallery(manifestUrl) {
  try {
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const manifest = await response.json();

    if (!manifest.sequences || !manifest.sequences[0].canvases) {
      throw new Error('Manifest does not contain sequences or canvases in the expected format.');
    }

    // Store the manifest for later export
    collectedManifests.push(manifest);

    const canvasItems = manifest.sequences[0].canvases;
    const gallery = document.getElementById('gallery');

    canvasItems.forEach(canvas => {
      addCanvasToGallery(canvas, manifest);
    });

  } catch (error) {
    console.error('Error fetching IIIF Manifest:', error);
    alert(`There was an error fetching the IIIF Manifest: ${error.message}`);
  }
}

// Function to export the collected manifests as a combined manifest
function exportCombinedManifest() {
  // Get the user-defined name for the manifest
  const manifestName = document.getElementById('manifestName').value.trim() || 'combined_manifest';

  const combinedManifest = {
    '@context': 'http://iiif.io/api/presentation/3.0/context.json',
    id: 'http://example.org/combined-manifest',
    type: 'Manifest',
    label: { 'en': ['Combined Manifest'] },
    items: [] // Use 'items' for a single manifest
  };

  // Add each of the collected manifests to the combined manifest
  collectedManifests.forEach(manifest => {
    combinedManifest.items.push(manifest);
  });

  // Convert the combined manifest to a JSON string
  const jsonStr = JSON.stringify(combinedManifest, null, 2);

  // Create a blob to download
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a link to download the file
  const a = document.createElement('a');
  a.href = url;
  a.download = `${manifestName}.json`; // Use the user-defined name
  
  // Programmatically click the link to trigger the download
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// Event listener to add manifest URLs to the gallery
document.getElementById('addManifest').addEventListener('click', async () => {
  const manifestUrls = document.getElementById('manifestUrl').value.split(',').map(url => url.trim());
  if (!manifestUrls.length) {
    alert('Please enter one or more IIIF Manifest URLs');
    return;
  }

  for (const manifestUrl of manifestUrls) {
    if (manifestUrl) {
      await addManifestToGallery(manifestUrl);
    }
  }
});

// Event listener to load the uploaded combined manifest
document.getElementById('loadManifest').addEventListener('click', async () => {
    const fileInput = document.getElementById('uploadManifest');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a JSON file to upload.');
        return;
    }

    const reader = new FileReader();
    
    reader.onload = async function(event) {
        const jsonContent = event.target.result;
        try {
            const manifestData = JSON.parse(jsonContent);
            repopulateGallery(manifestData); // Call your existing method to populate the gallery
        } catch (error) {
            console.error('Error parsing JSON:', error);
            alert('Failed to load manifest: ' + error.message);
        }
    };

    reader.readAsText(file); // Read the file as text
});

// Event listener for the export button
document.getElementById('export-manifest').addEventListener('click', exportCombinedManifest);