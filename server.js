const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory data stores for the prototype
const users = [];
const agencies = [];
let rescueRequests = [];

// API Endpoints

// Mock Login
app.post('/api/login', (req, res) => {
    const { username, role } = req.body;
    
    if (!username || !role) {
        return res.status(400).json({ error: 'Username and role are required' });
    }

    if (role === 'user') {
        users.push(username);
        return res.json({ message: 'Logged in as User', username, role });
    } else if (role === 'agency') {
        agencies.push(username);
        return res.json({ message: 'Logged in as Agency', username, role });
    } else {
        return res.status(400).json({ error: 'Invalid role' });
    }
});

// Submit a rescue request
app.post('/api/request', (req, res) => {
    const { user, location, description, emergencyType } = req.body;
    
    if (!user || !location || !emergencyType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newRequest = {
        id: Date.now().toString(),
        user,
        location,
        description: description || 'No description provided.',
        emergencyType,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    rescueRequests.push(newRequest);
    
    res.status(201).json({ message: 'Rescue request submitted successfully', request: newRequest });
});

// Fetch all active rescue requests (for agencies)
app.get('/api/requests', (req, res) => {
    // Agencies could potentially filter by status or location in a real app
    res.json(rescueRequests);
});

// Update request status (optional, but good for flow)
app.put('/api/request/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const requestIndex = rescueRequests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
        return res.status(404).json({ error: 'Request not found' });
    }

    rescueRequests[requestIndex].status = status;
    res.json({ message: 'Status updated', request: rescueRequests[requestIndex] });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
