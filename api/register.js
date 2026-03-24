export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get environment variables you will set in Vercel
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; 
  const REPO_OWNER = 'Mohammed-Muhaimin';
  const REPO_NAME = 'CypherX-Reg-Website';
  const FILE_PATH = 'registrations.csv';

  // Extract the form data (Vercel automatically parses urlencoded body into req.body)
  const data = req.body || {};
  
  // Format the data as a CSV row (matching your form fields)
  // sanitize quotes to avoid breaking csv format
  const sanitize = (val) => val ? String(val).replace(/"/g, '""') : '';
  const newCsvRow = `"${sanitize(data['Team Name'])}","${sanitize(data['Member 1 Name'])}","${sanitize(data['Member 1 Reg No'])}","${sanitize(data['Member 2 Name'])}","${sanitize(data['Member 2 Reg No'])}","${sanitize(data['email'])}","${sanitize(data['phone'])}","${sanitize(data['College Name'])}","${sanitize(data['Department'])}","${sanitize(data['CTF Experience'])}","${sanitize(data['Transaction ID'])}"\n`;

  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    // 1. Get the current registrations.csv file to find its 'sha' (required for updates)
    const getRes = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    
    let currentContent = '';
    let sha = null;

    if (getRes.status === 200) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    } else if (getRes.status === 404) {
      // If the file doesn't exist yet, create the header row!
      currentContent = `"Team Name","Member 1 Name","Member 1 Reg No","Member 2 Name","Member 2 Reg No","Email","Phone","College Name","Department","CTF Experience","Transaction ID"\n`;
    }

    // 2. Append the new row to the existing content
    const updatedContent = currentContent + newCsvRow;

    // 3. Commit the updated file back to GitHub
    const updateRes = await fetch(url, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `New Registration: ${data['Team Name'] || 'Unknown Team'}`,
        content: Buffer.from(updatedContent).toString('base64'),
        ...(sha && { sha }) // Only passed if the file already exists
      })
    });

    if (updateRes.ok) {
      // Successfully saved! Redirect them from the API back to a success page or the same page
      res.redirect(302, '/?success=true');
    } else {
      const errorData = await updateRes.json();
      res.status(500).json({ error: 'Failed to save to GitHub', details: errorData });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
