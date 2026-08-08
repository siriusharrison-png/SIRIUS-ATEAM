const { IncomingForm } = require('formidable');
const fs = require('fs');
const path = require('path');
const { tagImageFromUrl, uploadAndTagImage } = require('../lib/imagga');

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk.toString();
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
      const body = await getRawBody(req);
      const parsed = JSON.parse(body || '{}');
      const { urls } = parsed;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array is required' });
      }

      const results = [];
      for (const url of urls) {
        try {
          const tags = await tagImageFromUrl(url);
          results.push({
            url,
            tags: tags.join(','),
            success: true
          });
        } catch (error) {
          results.push({
            url,
            error: error.message,
            success: false
          });
        }
      }

      return res.status(200).json(results);
    }

    if (req.method === 'POST') {
      const form = new IncomingForm({
        maxFileSize: 50 * 1024 * 1024
      });

      const [fields, files] = await form.parse(req);

      if (!files.images || files.images.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }

      const results = [];
      for (const file of files.images) {
        try {
          const tags = await uploadAndTagImage(file.filepath);
          results.push({
            filename: file.originalFilename,
            tags: tags.join(','),
            success: true
          });
          try {
            fs.unlinkSync(file.filepath);
          } catch (e) {
            // ignore cleanup errors
          }
        } catch (error) {
          results.push({
            filename: file.originalFilename,
            error: error.message,
            success: false
          });
          try {
            if (fs.existsSync(file.filepath)) {
              fs.unlinkSync(file.filepath);
            }
          } catch (e) {
            // ignore cleanup errors
          }
        }
      }

      return res.status(200).json(results);
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        message: 'Tag Image API',
        endpoints: {
          'POST /api/tag (JSON)': {
            description: 'Tag images from URLs',
            body: { urls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'] }
          },
          'POST /api/tag (Form)': {
            description: 'Tag uploaded images',
            body: 'multipart/form-data with images field'
          }
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

module.exports = handler;

