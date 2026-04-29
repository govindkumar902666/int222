document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    
    // Views
    const loginView = document.getElementById('loginView');
    const userDashboardView = document.getElementById('userDashboardView');
    const agencyDashboardView = document.getElementById('agencyDashboardView');
    
    // Nav
    const userInfo = document.getElementById('userInfo');
    const userNameDisplay = document.getElementById('userNameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Forms
    const userLoginForm = document.getElementById('userLoginForm');
    const agencyLoginForm = document.getElementById('agencyLoginForm');
    const rescueRequestForm = document.getElementById('rescueRequestForm');
    
    // Inputs & Buttons
    const usernameInput = document.getElementById('usernameInput');
    const agencyNameInput = document.getElementById('agencyNameInput');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationInput = document.getElementById('locationInput');
    const requestStatusMessage = document.getElementById('requestStatusMessage');
    const refreshRequestsBtn = document.getElementById('refreshRequestsBtn');
    const requestsGrid = document.getElementById('requestsGrid');

    // --- State ---
    let currentUser = null;
    let refreshInterval = null;
    let map = null;
    let markersLayer = null;

    // --- Helper Functions ---
    
    const showView = (viewElement) => {
        // Hide all views
        loginView.classList.add('hidden');
        loginView.classList.remove('active-view');
        userDashboardView.classList.add('hidden');
        userDashboardView.classList.remove('active-view');
        agencyDashboardView.classList.add('hidden');
        agencyDashboardView.classList.remove('active-view');
        
        // Show target view
        viewElement.classList.remove('hidden');
        viewElement.classList.add('active-view');
        
        // Ensure map renders correctly if agency dashboard is shown
        if (viewElement === agencyDashboardView && map) {
            setTimeout(() => { map.invalidateSize(); }, 100);
        }
    };

    const updateNav = () => {
        if (currentUser) {
            userInfo.classList.remove('hidden');
            userNameDisplay.textContent = `${currentUser.role === 'agency' ? '🏢' : '👤'} ${currentUser.username}`;
        } else {
            userInfo.classList.add('hidden');
        }
    };

    const login = async (username, role) => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                currentUser = data;
                updateNav();
                
                if (role === 'user') {
                    showView(userDashboardView);
                } else if (role === 'agency') {
                    showView(agencyDashboardView);
                    initMap();
                    fetchRequests();
                    // Auto refresh requests every 10 seconds for agencies
                    refreshInterval = setInterval(fetchRequests, 10000);
                }
            } else {
                alert(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Could not connect to server.');
        }
    };

    const logout = () => {
        currentUser = null;
        updateNav();
        showView(loginView);
        
        // Reset forms
        userLoginForm.reset();
        agencyLoginForm.reset();
        rescueRequestForm.reset();
        requestStatusMessage.classList.add('hidden');
        
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
    };

    const submitRescueRequest = async (requestData) => {
        try {
            const response = await fetch('/api/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            requestStatusMessage.classList.remove('hidden', 'msg-error', 'msg-success');
            
            if (response.ok) {
                requestStatusMessage.textContent = 'Request Sent Successfully! Help is on the way.';
                requestStatusMessage.classList.add('msg-success');
                rescueRequestForm.reset();
            } else {
                requestStatusMessage.textContent = data.error || 'Failed to send request.';
                requestStatusMessage.classList.add('msg-error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            requestStatusMessage.classList.remove('hidden');
            requestStatusMessage.textContent = 'Network error. Please try again immediately.';
            requestStatusMessage.classList.add('msg-error');
        }
    };

    const fetchRequests = async () => {
        if (!currentUser || currentUser.role !== 'agency') return;
        
        try {
            const response = await fetch('/api/requests');
            const requests = await response.json();
            
            if (response.ok) {
                renderRequests(requests);
            }
        } catch (error) {
            console.error('Fetch requests error:', error);
            requestsGrid.innerHTML = '<div class="loading-state">Error loading requests. Ensure server is running.</div>';
        }
    };

    // --- Map & Geocoding Logic ---
    const initMap = () => {
        if (!map) {
            // Center roughly on India
            map = L.map('map').setView([20.5937, 78.9629], 5);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
            
            markersLayer = L.layerGroup().addTo(map);
        }
    };

    const geocodeLocation = async (locationStr) => {
        // Check if it's already coordinates (lat, lng)
        const coordMatch = locationStr.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
        if (coordMatch) {
            return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[3]) };
        }

        // Otherwise use free Nominatim geocoding
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr + ', India')}`);
            const data = await res.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        } catch (e) {
            console.error('Geocoding failed for:', locationStr);
        }
        return null;
    };

    const plotRequestsOnMap = async (requests) => {
        if (!markersLayer) return;
        markersLayer.clearLayers();
        
        for (const req of requests) {
            const coords = await geocodeLocation(req.location);
            if (coords) {
                const marker = L.marker([coords.lat, coords.lng]).addTo(markersLayer);
                
                // Color code by emergency type could be added here, using custom icons
                let typeEmoji = '🚨';
                if (req.emergencyType === 'fire') typeEmoji = '🔥';
                if (req.emergencyType === 'medical') typeEmoji = '🚑';
                if (req.emergencyType === 'flood') typeEmoji = '🌊';
                
                marker.bindPopup(`
                    <b>${typeEmoji} ${req.emergencyType.toUpperCase()}</b><br>
                    <b>User:</b> ${req.user}<br>
                    <b>Loc:</b> ${req.location}<br>
                    <p style="margin:5px 0;">${req.description}</p>
                `);
                
                // Attach coords to req for list clicking
                req.coords = coords;
            }
        }
    };

    const renderRequests = async (requests) => {
        if (requests.length === 0) {
            requestsGrid.innerHTML = '<div class="loading-state">No active rescue requests at the moment.</div>';
            if (markersLayer) markersLayer.clearLayers();
            return;
        }

        // Sort by newest first
        requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Plot on map first so we have coordinates attached for list clicking
        await plotRequestsOnMap(requests);

        requestsGrid.innerHTML = '';
        
        requests.forEach(req => {
            const timeStr = new Date(req.timestamp).toLocaleTimeString();
            const dateStr = new Date(req.timestamp).toLocaleDateString();
            
            const card = document.createElement('div');
            card.className = 'request-card';
            card.innerHTML = `
                <div class="req-header">
                    <span class="req-type">${req.emergencyType}</span>
                    <span class="req-time">${dateStr} ${timeStr}</span>
                </div>
                <div class="req-user">${req.user}</div>
                <div class="req-location">📍 ${req.location}</div>
                <div class="req-desc">${req.description}</div>
                <div>
                    <span class="status-badge">${req.status.toUpperCase()}</span>
                </div>
            `;
            
            // Add click event to fly to map location
            card.addEventListener('click', () => {
                // Highlight active card
                document.querySelectorAll('.request-card').forEach(c => c.classList.remove('active-card'));
                card.classList.add('active-card');
                
                if (req.coords && map) {
                    map.flyTo([req.coords.lat, req.coords.lng], 12, { duration: 1.5 });
                    
                    // Open popup if we can find the matching marker
                    markersLayer.eachLayer(layer => {
                        const latLng = layer.getLatLng();
                        if (latLng.lat === req.coords.lat && latLng.lng === req.coords.lng) {
                            layer.openPopup();
                        }
                    });
                }
            });
            
            requestsGrid.appendChild(card);
        });
    };

    // --- Event Listeners ---

    userLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (username) login(username, 'user');
    });

    agencyLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const agencyName = agencyNameInput.value.trim();
        if (agencyName) login(agencyName, 'agency');
    });

    logoutBtn.addEventListener('click', logout);

    rescueRequestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const requestData = {
            user: currentUser.username,
            emergencyType: document.getElementById('emergencyType').value,
            location: locationInput.value.trim(),
            description: document.getElementById('descriptionInput').value.trim()
        };

        submitRescueRequest(requestData);
    });

    refreshRequestsBtn.addEventListener('click', fetchRequests);

    // HTML5 Geolocation
    getLocationBtn.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            locationInput.placeholder = "Locating...";
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude.toFixed(6);
                    const lng = position.coords.longitude.toFixed(6);
                    locationInput.value = `${lat}, ${lng}`;
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    alert("Could not get your location. Please type it manually.");
                    locationInput.placeholder = "e.g., 123 Main St, City or GPS Coordinates";
                }
            );
        } else {
            alert("Geolocation is not supported by your browser.");
        }
    });
});
