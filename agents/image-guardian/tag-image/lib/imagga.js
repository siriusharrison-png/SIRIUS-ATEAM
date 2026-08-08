const https = require('https');
const { IncomingForm } = require('formidable');
const fs = require('fs');
const path = require('path');

const IMAGGA_API_KEY = process.env.IMAGGA_API_KEY;
const IMAGGA_API_SECRET = process.env.IMAGGA_API_SECRET;

if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) {
  console.error('Missing Imagga API credentials in environment variables');
}

function makeImaggaRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    if (!IMAGGA_API_KEY || !IMAGGA_API_SECRET) {
      return reject(new Error('Imagga API credentials not configured'));
    }
    const auth = Buffer.from(`${IMAGGA_API_KEY}:${IMAGGA_API_SECRET}`).toString('base64');

    const options = {
      hostname: 'api.imagga.com',
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function tagImageFromUrl(imageUrl) {
  const params = new URLSearchParams({
    image_url: imageUrl
  });

  const response = await makeImaggaRequest('GET', `/v2/tags?${params.toString()}`);

  if (response.status?.type !== 'success') {
    throw new Error(response.status?.error_message || 'Failed to tag image');
  }

  const tags = response.result?.tags || [];
  return tags
    .filter(tag => tag.confidence > 20)
    .map(tag => tag.tag.en)
    .slice(0, 20);
}

async function uploadAndTagImage(filePath) {
  const fileContent = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const boundary = '----FormBoundary' + Date.now();
  const boundaryLine = `--${boundary}`;

  const auth = Buffer.from(`${IMAGGA_API_KEY}:${IMAGGA_API_SECRET}`).toString('base64');

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.imagga.com',
      path: '/v2/tags',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.status?.type !== 'success') {
            reject(new Error(response.status?.error_message || 'Failed to tag image'));
          } else {
            const tags = response.result?.tags || [];
            const tagList = tags
              .filter(tag => tag.confidence > 20)
              .map(tag => tag.tag.en)
              .slice(0, 20);
            resolve(tagList);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);

    const header = Buffer.from(
      `${boundaryLine}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n${boundaryLine}--\r\n`);

    req.write(header);
    req.write(fileContent);
    req.write(footer);
    req.end();
  });
}

module.exports = { tagImageFromUrl, uploadAndTagImage };
