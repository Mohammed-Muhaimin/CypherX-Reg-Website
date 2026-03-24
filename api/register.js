import { IncomingForm } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // Disallow Vercel's default body parser so formidable can process it
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Environment variables needed in Vercel
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
  const IMGBB_API_KEY = process.env.IMGBB_API_KEY; 
  const REPO_OWNER = 'Mohammed-Muhaimin';
  const REPO_NAME = 'CypherX-Reg-Website';
  const FILE_PATH = 'registrations.csv';

  try {
    const form = new IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to parse form' });
      }

      // Formidable in newer versions returns arrays for fields
      const getFieldArrayText = (f) => Array.isArray(f) ? f[0] : f;

      const teamName = getFieldArrayText(fields['Team Name']);
      const m1Name = getFieldArrayText(fields['Member 1 Name']);
      const m1Reg = getFieldArrayText(fields['Member 1 Reg No']);
      const m2Name = getFieldArrayText(fields['Member 2 Name']);
      const m2Reg = getFieldArrayText(fields['Member 2 Reg No']);
      const email = getFieldArrayText(fields['email']);
      const phone = getFieldArrayText(fields['phone']);
      const college = getFieldArrayText(fields['College Name']);
      const dept = getFieldArrayText(fields['Department']);
      const ctfExp = getFieldArrayText(fields['CTF Experience']);
      const transactionId = getFieldArrayText(fields['Transaction ID']);
      
      const fileField = files['payment_screenshot'];
      const file = Array.isArray(fileField) ? fileField[0] : fileField;

      let upiImageUrl = '';

      // Upload the image to ImgBB if one was provided
      if (file && file.filepath) {
        const imageBuffer = fs.readFileSync(file.filepath);
        const base64Image = imageBuffer.toString('base64');
        
        const imgBbFormData = new URLSearchParams();
        imgBbFormData.append('image', base64Image);

        try {
          const imgBbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: imgBbFormData
          });
          const imgBbData = await imgBbRes.json();
          if (imgBbData.success) {
            upiImageUrl = imgBbData.data.url;
          } else {
            console.error("ImgBB upload failed", imgBbData);
          }
        } catch (e) {
          console.error("ImgBB fetch error", e);
        }
      }

      // Format the data as a CSV row
      const sanitize = (val) => val ? String(val).replace(/"/g, '""') : '';
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const newCsvRow = `"${sanitize(teamName)}","${sanitize(m1Name)}","${sanitize(m1Reg)}","${sanitize(m2Name)}","${sanitize(m2Reg)}","${sanitize(email)}","${sanitize(phone)}","${sanitize(college)}","${sanitize(dept)}","${sanitize(ctfExp)}","${sanitize(transactionId)}","${sanitize(upiImageUrl)}","${sanitize(timestamp)}"\n`;

      const githubUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
      
      // 1. Get the current registrations.csv file to find its 'sha' (required for updates)
      const getRes = await fetch(githubUrl, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
      });
      
      let currentContent = '';
      let sha = null;

      if (getRes.status === 200) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      } else if (getRes.status === 404) {
        // Create the header row if file doesn't exist
        currentContent = `"Team Name","Member 1 Name","Member 1 Reg No","Member 2 Name","Member 2 Reg No","Email","Phone","College Name","Department","CTF Experience","Transaction ID","UPI Screenshot URL","Registration Time"\n`;
      }

      // 2. Append the new row to the existing content
      const updatedContent = currentContent + newCsvRow;

      // 3. Commit the updated file back to GitHub
      const updateRes = await fetch(githubUrl, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `New Registration: ${sanitize(teamName) || 'Unknown Team'}`,
          content: Buffer.from(updatedContent).toString('base64'),
          ...(sha && { sha }) // Only passed if the file already exists
        })
      });

      if (updateRes.ok) {
        // Successfully saved! Redirect them from the API back to a success page
        res.redirect(302, '/?success=true');
      } else {
        const errorData = await updateRes.json();
        console.error(errorData);
        res.status(500).json({ error: 'Failed to save to GitHub', details: errorData });
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
