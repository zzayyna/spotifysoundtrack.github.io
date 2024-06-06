const clientId = 'd5c3f91a3a994aa18c2479a15f6f9a5b';
const redirectUri = 'https://zzayyna.github.io/spotifysoundtrack.github.io/';
const scopes = 'user-top-read'; 

document.getElementById('button').addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
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

function getTopTracks(accessToken){
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
        const actionDiv = document.getElementById('action'); 
        const romanceDiv = document.getElementById('romance');
        
        let gotAction = false;
        let gotRomance = false;

        function checkTrackGenres(track, artist, genres) {
            if (!gotAction && ((genres.includes('rock') || genres.includes('grunge') || genres.includes('alternative rock') || genres.includes('album rock') || genres.includes('alternative emo') || genres.includes('alternative pop rock') || genres.includes('classic rock') || genres.includes('edm') || genres.includes('rap rock') || genres.includes('trap') || genres.includes('trapstep') || genres.includes('dubstep') || genres.includes('cinematic dubstep') || genres.includes('death metal') || genres.includes('metal') || genres.includes('screamo')))) {
                actionDiv.innerHTML = `<p>${track.name}</p><p>${artist.name}</p><p>${genres.join(', ')}</p>`;
                gotAction = true;
            }

            if (!gotRomance && (genres.includes('new romantic') || genres.includes('bedroom pop') || genres.includes('pop') || genres.includes('indie'))) {
                romanceDiv.innerHTML = `<p>${track.name}</p><p>${artist.name}</p><p>${genres.join(', ')}</p>`;
                gotRomance = true;
            }

            return gotAction && gotRomance; // Stop further processing if both conditions are met
        }

        // Loop through tracks and artists
        (async function() {
            for (let track of tracks) {
                for (let artist of track.artists) {
                    const artistId = artist.id;
                    const genres = await getArtistGenre(accessToken, artistId);
                    const shouldBreak = checkTrackGenres(track, artist, genres);
                    if (shouldBreak) {
                        return; // Exit the loop early
                    }
                }
            }
        })();
    })
    .catch(error => {
        console.error('Error fetching top tracks:', error);
    });
}

function getArtistGenre(accessToken, artistId) {
    return fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch artist details.');
        }
        return response.json();
    })
    .then(data => data.genres)
    .catch(error => {
        console.error('Error fetching artist details:', error);
        return [];
    });
}

// Ensure the code executes on page load

document.addEventListener('DOMContentLoaded', () => {
    const code = getCodeFromUrl();
    if (code) {
        getAccessToken(code)
            .then(accessToken => {
                if (accessToken) {
                    getTopTracks(accessToken);
                } else {
                    console.error('Failed to get access token.');
                }
            });
    }
});
