const clientId = '241de437d0514ac1aa204e5435652b01'; 
const clientSecret = '1e84c1fd7e56403c82df49752132ed9a'; 
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
            'client_secret': clientSecret,
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

function getAllTracks(accessToken, url = 'https://api.spotify.com/v1/me/tracks', allTracks = []) {
    fetch(url, {
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
        const newTracks = data.items.map(item => item.track);
        allTracks = allTracks.concat(newTracks);
        if (data.next) {
            // If there is a next page, fetch it
            getAllTracks(accessToken, data.next, allTracks);
        } else {
            // No more pages, process the collected tracks
            processTracks(allTracks, accessToken);
        }
    })
    .catch(error => {
        console.error('Error fetching saved tracks:', error);
    });
}

function processTracks(tracks, accessToken) {
    console.log(`Processing ${tracks.length} tracks`);

    // Break tracks into batches of 100 for fetching audio features
    const batches = [];
    for (let i = 0; i < tracks.length; i += 100) {
        batches.push(tracks.slice(i, i + 100));
    }

    const promises = batches.map(batch => {
        const trackIds = batch.map(track => track.id).join(',');
        return fetchWithRetry(`https://api.spotify.com/v1/audio-features?ids=${trackIds}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
        .then(response => response.json())
        .then(data => data.audio_features);
    });

    Promise.all(promises)
    .then(results => {
        const audioFeatures = results.flat();
        console.log('Audio features:', audioFeatures);
        const genres = ["action", "romance", "indie", "horror", "fantasy", "drama"];
        genres.forEach(genre => {
            const track = getGenreTrack(tracks, audioFeatures, genre);
            const div = document.getElementById(genre);
            const imageUrl = track.album.images[0].url;
            if (track) {
                div.innerHTML = `<img src="${imageUrl}" alt="${track.name}" style="width: 150px; height: 150px;"><p>${track.name}</p><p>${track.artists.map(artist => artist.name).join(', ')}</p>`;
            } else {
                div.innerHTML = `<p>No suitable track found for ${genre}.</p>`;
            }
        });
    })
    .catch(error => {
        console.error('Error fetching audio features:', error);
    });
}

function getGenreTrack(tracks, audioFeatures, genre) {
    let selectedTrack = null;
    let maxScore = -Infinity;

    const genreCriteria = {
        action: { energy: [0.6, 1.0], tempo: [120, 200], danceability: [0.6, 1.0] },
        romance: { tempo: [60, 120], acousticness: [0.4, 1.0], valence: [0.4, 1.0], energy: [0.2, 0.6] },
        indie: { instrumentalness: [0.3, 1.0], acousticness: [0.4, 1.0], energy: [0.2, 0.7], tempo: [80, 140] },
        horror: { valence: [0.0, 0.4], instrumentalness: [0.3, 1.0], tempo: [0, 110], acousticness: [0.4, 1.0]},
        fantasy: { valence: [0.5, 1.0], tempo: [100, 160], energy: [0.4, 0.8], instrumentalness: [0.0, 0.3] },
        drama: { tempo: [60, 130], acousticness: [0.4, 0.9], energy: [0.0, 0.5], valence: [0.0, 0.5] }
    };

    const criteria = genreCriteria[genre];

    audioFeatures.forEach((feature, index) => {
        let score = 0;
        let isWithinRange = true;
        for (const key in criteria) {
            const [min, max] = criteria[key];
            const value = feature[key] || 0;
            if (value < min || value > max) {
                isWithinRange = false;
                break;
            }
            score += value; // Summing up the values for scoring
        }

        if (isWithinRange && score > maxScore) {
            selectedTrack = tracks[index];
            maxScore = score;
        }
    });

    return selectedTrack;
}

function fetchWithRetry(url, options, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
        const doFetch = (retryCount) => {
            fetch(url, options)
                .then(response => {
                    if (response.ok) {
                        resolve(response);
                    } else if (response.status === 429 && retryCount < maxRetries) {
                        setTimeout(() => doFetch(retryCount + 1), delay * Math.pow(2, retryCount));
                    } else {
                        reject(new Error(`Failed to fetch data. Status: ${response.status}`));
                    }
                })
                .catch(error => {
                    reject(error);
                });
        };

        doFetch(0);
    });
}

// Execution
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
