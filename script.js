const clientId = 'd5c3f91a3a994aa18c2479a15f6f9a5b';
const redirectUri = 'https://zzayyna.github.io/spotifysoundtrack.github.io/';
const scopes = 'user-top-read user-library-read'; 

document.getElementById('button').addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    localStorage.setItem('type', 'top');
    window.location.href = authUrl;
});

document.getElementById('all').addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    localStorage.setItem('type', 'all');
    window.location.href = authUrl;
});

function getCodeFromUrl() {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('code');
}

function getAccessToken(code) {
    const authOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirectUri,
            'client_id': clientId,
            'client_secret': '816aae964c1a4960b06b874dc0ba7a5b',
        })
    };

    return fetch('https://accounts.spotify.com/api/token', authOptions)
        .then(response => response.json())
        .then(data => data.access_token)
        .catch(error => {
            console.error('Error exchanging authorization code for access token:', error);
            return null;
        });
}

function getTopTracks(accessToken) {
    fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch top tracks.');
        }
        return response.json();
    })
    .then(data => {
        const tracks = data.items;
        processTracks(tracks, accessToken);
    })
    .catch(error => {
        console.error('Error fetching top tracks:', error);
    });
}

function getAllTracks(accessToken, url = 'https://api.spotify.com/v1/me/tracks') {
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch saved tracks.');
        }
        return response.json();
    })
    .then(data => {
        const tracks = data.items.map(item => item.track); // Get the actual tracks
        processTracks(tracks, accessToken);
    })
    .catch(error => {
        console.error('Error fetching saved tracks:', error);
    });
}

function processTracks(tracks, accessToken) {
    const genres = ["action", "romance", "indie", "horror", "fantasy", "drama"];
    genres.forEach(genre => {
        getGenreTrack(tracks, accessToken, genre).then(track => {
            const div = document.getElementById(genre);
            if (track) {
                div.innerHTML = `<p>${track.name}</p><p>${track.artists.map(artist => artist.name).join(', ')}</p>`;
            } else {
                div.innerHTML = `<p>No suitable track found for ${genre}.</p>`;
            }
        });
    });
}

async function getGenreTrack(tracks, accessToken, genre) {
    let selectedTrack = null;
    let maxScore = -Infinity;

    const genreCriteria = {
        action: { energy: [0.6, 1.0], tempo: [120, 180], danceability: [0.6, 1.0] },
        romance: { tempo: [60, 120], acousticness: [0.4, 1.0], valence: [0.4, 1.0], energy: [0.2, 0.6] },
        indie: { instrumentalness: [0.3, 1.0], acousticness: [0.4, 1.0], energy: [0.2, 0.7], tempo: [80, 140] },
        horror: { valence: [0.0, 0.3], instrumentalness: [0.5, 1.0], tempo: [60, 120], speechiness: [0.3, 1.0] },
        fantasy: { energy: [0.4, 0.8], tempo: [60, 120], acousticness: [0.6, 1.0], instrumentalness: [0.5, 1.0] },
        drama: { tempo: [60, 120], acousticness: [0.4, 1.0], energy: [0.3, 0.7], valence: [0.4, 0.8] }
    };

    const criteria = genreCriteria[genre];

    const promises = tracks.map(track => {
        const trackId = track.id;
        return fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch track audio features.');
            }
            return response.json();
        })
        .then(data => {
            let score = 0;
            let isWithinRange = true;
            for (const feature in criteria) {
                const [min, max] = criteria[feature];
                const value = data[feature] || 0;
                if (value < min || value > max) {
                    isWithinRange = false;
                    break;
                }
                score += value; // Summing up the values for scoring
            }

            if (isWithinRange && score > maxScore) {
                selectedTrack = track;
                maxScore = score;
            }
        })
        .catch(error => {
            console.error(`Error fetching track audio features for track ${trackId}:`, error);
        });
    });

    await Promise.all(promises);

    return selectedTrack;
}

// execution
document.addEventListener('DOMContentLoaded', () => {
    const code = getCodeFromUrl();
    if (code) {
        getAccessToken(code)
            .then(accessToken => {
                const type = localStorage.getItem('type');
                if (accessToken && type === 'top') {
                    getTopTracks(accessToken);
                } else if (accessToken && type === 'all') {
                    getAllTracks(accessToken);
                } else {
                    console.error('Failed to get access token or invalid type.');
                }
            });
    }
});
