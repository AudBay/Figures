const guides = {
    oticon: {
        title: "Oticon Hearing Aid & App Guide",
        sections: [
            {
                heading: "Ear Identification",
                content: "Your hearing aids are color-coded to help you identify which side is which:\n• Left Ear = Blue\n• Right Ear = Red"
            },
            {
                heading: "Power & Charging",
                content: "Automatic Method: Place your hearing aids in the charger to turn them off. When you remove them, they will turn back on automatically. No button presses are needed when using the charger.\n\nLights Guide: Amber = Charging | Green = Fully Charged\n\nManual Method (Without Charger): Press and hold the button for 3 seconds to turn off (amber light). Press and hold for 2 seconds to turn on (green light)."
            },
            {
                heading: "Maintenance",
                content: "• Domes: Wipe the silicone dome every night with a clean wipe. Change the dome every 3 months.\n• Microphones: Use the brush and cloth to clean the microphone openings every couple of weeks."
            },
            {
                heading: "Changing the Wax Filter",
                content: "If the sound is quiet or weak, the filter may be blocked:\n1. Use the tool provided: the empty side removes the old filter, and the other side holds the new one.\n2. Press the empty side into the filter in the wire to remove it.\n3. Push the new filter into the wire and discard the tool."
            },
            {
                heading: "Using the App",
                image: "oticon-app-1.jpg", // Replace with your actual image filename
                content: "1. Programs (If Applicable): If you have extra settings, swipe across the top to change them.\n2. Volume: Slide up or tap (+) for louder, and down or (-) for quieter.\n3. Mute & Split: Tap the speaker icon to mute. Tap the bars to adjust each ear independently.\n4. Equalizer: Tap the sliders icon to adjust the sound pitch.\n\nAdjusting the sound: If it sounds 'tinny,' lower the volume slightly or use the Equalizer to reduce the High frequencies. Tap 'Restore Default' to reset."
            },
            {
                heading: "Battery & Location",
                image: "oticon-app-2.jpg", // Replace with your actual image filename
                content: "1. Battery Life: Check the percentage and remaining hours for both hearing aids.\n2. Find My Hearing Aids: Shows the last location where your aids were connected to your phone.\n\nLost Devices: The app shows the last known location while connected. It does not track the hearing aid live if it is moved after losing connection."
            }
        ]
    },
    starkey: {
        title: "Starkey Hearing Aid & App Guide",
        sections: [
            {
                heading: "Power & Charging",
                content: "Place your hearing aids securely in the Starkey charger to power them down and begin charging."
            },
            {
                heading: "Using the My Starkey App",
                image: "starkey-app.jpg", // Placeholder image file
                content: "[Insert your specific Starkey app instructions here. Ensure your numbered points match the image callouts.]"
            }
        ]
    },
    widex: {
        title: "Widex Hearing Aid & App Guide",
        sections: [
            {
                heading: "Power & Charging",
                content: "Place your hearing aids in the Widex charging port. Ensure they are seated correctly to begin the charging process."
            },
            {
                heading: "Using the Widex App",
                image: "widex-app.jpg", // Placeholder image file
                content: "[Insert your specific Widex app instructions here. Ensure your numbered points match the image callouts.]"
            }
        ]
    }
};

function loadGuide(brand) {
    const container = document.getElementById('guide-content');
    const data = guides[brand];
    
    // Update active navbar selection
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${brand}`).classList.add('active');
    
    // Build dynamic HTML layout
    let html = `<h2>${data.title}</h2>`;
    data.sections.forEach(sec => {
        const formattedContent = sec.content.replace(/\n/g, '<br>');
        
        if (sec.image) {
            html += `
                <section class="guide-section">
                    <h3>${sec.heading}</h3>
                    <div class="app-instruction-container">
                        <img src="${sec.image}" alt="App Interface for ${brand}" class="app-image">
                        <div class="app-text">
                            <p>${formattedContent}</p>
                        </div>
                    </div>
                </section>
            `;
        } else {
            html += `
                <section class="guide-section">
                    <h3>${sec.heading}</h3>
                    <p>${formattedContent}</p>
                </section>
            `;
        }
    });
    
    container.innerHTML = html;
}

// Default initialization
window.onload = () => loadGuide('oticon');
