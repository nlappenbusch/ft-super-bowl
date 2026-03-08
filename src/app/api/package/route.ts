import { NextResponse } from 'next/server';
import { generateProductSchema } from '@/lib/schema';
import {
  DEFAULT_EVENT_SLUG,
  DEFAULT_PACKAGE_SLUG,
  getEventBySlug,
  getPackageBySlug,
  toPackageCardData,
  PackageCardData
} from '@/lib/eventData';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventSlug = searchParams.get('event') || DEFAULT_EVENT_SLUG;
  const packageSlug = searchParams.get('package') || DEFAULT_PACKAGE_SLUG;
  const event = await getEventBySlug(eventSlug);
  const baseUrl = event?.base_url || process.env.NEXT_PUBLIC_SITE_URL || 'https://superbowl.faltintravel.com';
  const imageBase = baseUrl.replace(/\/$/, '');

  const staticPackageData: PackageCardData = {
    id: 'dream_hollywood',
    packageName: 'Ticket- & Hotel-Package',
    stars: 4,
    nights: 4,
    price: 8950,
    singleSupplement: 1485,
    title: 'Dream Hollywood, by Hyatt',
    description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
    hotel: 'Dream Hollywood, by Hyatt',
    hotelImages: [
      `${imageBase}/bilder-hotel/540997872.jpg`,
      `${imageBase}/bilder-hotel/540998091.jpg`,
      `${imageBase}/bilder-hotel/568783347.jpg`
    ],
    distances: {
      airport: '40 Min. / ca. 30 km (LAX)',
      stadium: '35 Min. / ca. 29 km (SoFi Stadium)',
      downtown: '20 Min. / ca. 11 km'
    },
    roomCategories: ['Doppelzimmer', 'Einzelzimmer'],
    popular: true,
    availableSpots: 12, // Verfügbare Plätze (Social Proof)
    rating: 4.8,
    reviews: 156,
    includes: [],
    extensionNights: 'Verlaengerungsnaechte auf Anfrage gegen Aufpreis buchbar',
    badgeText: 'Offizielles Hospitality-Package'
  };

  const packageRecord = await getPackageBySlug(eventSlug, packageSlug);
  const packageData = packageRecord
    ? toPackageCardData(packageRecord, imageBase)
    : staticPackageData;
  const bookingUrl = `${baseUrl}/booking?event=${encodeURIComponent(eventSlug)}&package=${encodeURIComponent(packageSlug)}`;
  const productSchema = generateProductSchema({
    name: `${event?.name || 'Event'} Package - ${packageData.title}`,
    description: packageData.description,
    price: packageData.price,
    priceCurrency: packageRecord?.currency || 'EUR',
    url: bookingUrl
  });

  // HTML für die interaktive Package Card
  const html = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      .superbowl-package-card {
        animation: fadeIn 0.6s ease-out;
      }
      
      .availability-badge {
        animation: pulse 2s infinite;
      }
      
      .price-update {
        transition: all 0.3s ease;
      }
      
      .room-option {
        transition: all 0.2s ease;
        cursor: pointer;
      }
      
      .room-option:hover {
        background: #f0f7ff !important;
        border-color: #184a7b !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(24,74,123,0.15);
      }
      
      .room-option.selected {
        background: #dbeafe !important;
        border-color: #1d4ed8 !important;
        border-width: 2px !important;
        box-shadow: 0 10px 18px rgba(29,78,216,0.2);
        position: relative;
      }

      .room-option.selected::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 6px;
        background: #1d4ed8;
        border-radius: 8px 0 0 8px;
      }

      .room-option .selected-badge {
        display: none;
        background: #184a7b;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 999px;
      }

      .room-option.selected .selected-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(29,78,216,0.3);
      }
      
      .cta-sticky {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        display: none;
        animation: fadeIn 0.3s ease-out;
      }
      
      @media (max-width: 768px) {
        .cta-sticky {
          left: 20px;
          right: 20px;
        }
      }
    </style>
    
    <div class="superbowl-package-card" style="max-width: 800px; margin: 0 auto; border: 2px solid #184a7b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; position: relative;">
      ${packageData.popular ? `
        <div style="background: linear-gradient(135deg, #f14624 0%, #d63d1f 100%); color: white; padding: 8px 16px; text-align: center; font-weight: bold; font-size: 14px;">
          ⭐ ${packageData.badgeText || 'Offizielles Hospitality-Package'}
        </div>
      ` : ''}
      
      <!-- Availability Badge (Social Proof) -->
      <div class="availability-badge" style="position: absolute; top: 20px; right: 20px; background: rgba(241,70,36,0.95); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
        ⏰ Nur noch ${packageData.availableSpots} Plätze verfügbar
      </div>
      
      <div style="padding: 32px;">
        <!-- Package Summary (First Step) -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700;">Event Reisepaket</div>
          <div style="margin-top: 6px; font-size: 14px; color: #1f2937; font-weight: 600;">
            Ticket- &amp; Hotel-Package
          </div>
          <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; margin-top: 12px;">
            <div>
              <ul style="margin: 0; padding-left: 18px; color: #374151; font-size: 13px; line-height: 1.5;">
                <li><strong>Event-Ticket:</strong> Kategorie 1 Sitzplatz im Unterrang</li>
                <li><strong>Hotel:</strong> ${packageData.hotel} &middot; ${packageData.stars}-Sterne</li>
                <li><strong>Transfers:</strong> Flughafen &amp; Stadion Transfers inklusive</li>
                <li><strong>Zusatzleistungen:</strong> Hospitality-Services &amp; Betreuung vor Ort</li>
              </ul>
              <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #475569;">
                <span style="background: #e2e8f0; padding: 4px 8px; border-radius: 999px;">🚌 LAX: ${packageData.distances.airport}</span>
                <span style="background: #e2e8f0; padding: 4px 8px; border-radius: 999px;">🏟️ Stadium: ${packageData.distances.stadium}</span>
                <span style="background: #e2e8f0; padding: 4px 8px; border-radius: 999px;">🌆 Downtown: ${packageData.distances.downtown}</span>
              </div>
            </div>
            <div>
              <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Hotel Eindrücke</div>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
                ${packageData.hotelImages.map((src) => `
                  <img src="${src}" alt="${packageData.hotel}" style="width: 100%; height: 64px; object-fit: cover; border-radius: 6px;" />
                `).join('')}
              </div>
            </div>
          </div>
          <div style="margin-top: 14px; padding: 10px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
            <div style="font-size: 13px; color: #1f2937; font-weight: 600;">Personen wählen (Preissicht)</div>
            <select id="person-count" onchange="window.superbowlSelectPersons_${packageData.id}(this.value)" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5f5; color: #1f2937; font-weight: 600;">
              <option value="1">1 Person</option>
              <option value="2" selected>2 Personen</option>
              <option value="3">3 Personen</option>
              <option value="4">4 Personen</option>
              <option value="5">5 Personen</option>
              <option value="6">6 Personen</option>
              <option value="7">7 Personen</option>
              <option value="8">8 Personen</option>
              <option value="9">9 Personen</option>
              <option value="10">10 Personen</option>
            </select>
            <div id="person-hint" style="font-size: 12px; color: #64748b;">Preis pro Person wird unten aktualisiert.</div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <h3 style="font-size: 28px; font-weight: bold; color: #184a7b; margin: 0;">
            ${packageData.title}
          </h3>
          <!-- Star Rating -->
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #fbbf24;">★★★★★</span>
            <span style="font-size: 14px; color: #666; font-weight: 600;">${packageData.rating}/5</span>
            <span style="font-size: 13px; color: #999;">(${packageData.reviews} Bewertungen)</span>
          </div>
        </div>
        
        <p style="color: #666; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
          ${packageData.description}
        </p>
        
        <!-- Room Type Selection (Interactive) -->
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">
            Wählen Sie Ihre Zimmerkategorie:
          </div>

          <div style="margin-bottom: 12px; font-size: 13px; color: #666;">
            Aktuelle Auswahl: <span id="selected-room-label" style="font-weight: 700; color: #184a7b;">Doppelzimmer</span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
            <!-- Doppelzimmer Option -->
            <div class="room-option selected" id="room-double" onclick="window.superbowlSelectRoom_${packageData.id}('double')" 
        style="border: 2px solid #1d4ed8; border-radius: 8px; padding: 16px; background: #dbeafe; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: #184a7b; font-size: 16px;">🛏️ Doppelzimmer</div>
                  <div style="font-size: 13px; color: #666; margin-top: 4px;">${packageData.nights} Nächte</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                  <span class="selected-badge">Ausgewählt</span>
                  <div style="font-size: 20px; font-weight: bold; color: #184a7b;">
                    ${packageData.price.toLocaleString('de-CH')} €
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Einzelzimmer Option -->
            <div class="room-option" id="room-single" onclick="window.superbowlSelectRoom_${packageData.id}('single')" 
                 style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; background: white; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: #333; font-size: 16px;">🛏️ Einzelzimmer</div>
                  <div style="font-size: 13px; color: #666; margin-top: 4px;">${packageData.nights} Nächte</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                  <span class="selected-badge">Ausgewählt</span>
                  <div style="font-size: 20px; font-weight: bold; color: #184a7b;">
                    ${(packageData.price + packageData.singleSupplement).toLocaleString('de-CH')} €
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Package Details -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">📅 Reisezeitraum:</div>
              <div style="font-weight: 600; color: #333;">12.-16. Februar 2027</div>
            </div>
            <div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">🏨 Übernachtungen:</div>
              <div style="font-weight: 600; color: #333;">${packageData.nights}x im <span id="room-type-text">Doppelzimmer</span></div>
            </div>
          </div>
        </div>
        
        <!-- Price & CTA -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <div id="price-display" class="price-update" style="font-size: 36px; font-weight: bold; color: #184a7b;">
                ${packageData.price.toLocaleString('de-CH')} €
              </div>
              <div style="font-size: 14px; color: #666;">pro Person im <span id="room-label">Doppelzimmer</span></div>
            </div>
            
            <a id="booking-cta" href="${bookingUrl}&room=double&price=${packageData.price}&nights=${packageData.nights}" 
               style="display: inline-block; background: #f14624; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; transition: all 0.3s; box-shadow: 0 2px 4px rgba(241,70,36,0.2);"
               onmouseover="this.style.background='#d63d1f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(241,70,36,0.3)';"
               onmouseout="this.style.background='#f14624'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(241,70,36,0.2)';">
              Jetzt unverbindlich anfragen →
            </a>
          </div>
        </div>
        
        <!-- Trust Elements -->
        <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666;">
            <span style="color: #10b981;">✓</span> Sichere Buchung
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666;">
            <span style="color: #10b981;">✓</span> Reisegarantie
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666;">
            <span style="color: #10b981;">✓</span> Kostenlose Beratung
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666;">
            <span style="color: #10b981;">✓</span> Flexible Zahlung
          </div>
        </div>
      </div>
    </div>
    
    <!-- Sticky CTA (appears on scroll) -->
    <div id="sticky-cta" class="cta-sticky">
      <a id="sticky-booking-link" href="${bookingUrl}&room=double&price=${packageData.price}&nights=${packageData.nights}"
         style="display: block; background: #f14624; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); text-align: center;"
         onmouseover="this.style.background='#d63d1f'"
         onmouseout="this.style.background='#f14624'">
        <span id="sticky-price">${packageData.price.toLocaleString('de-CH')} €</span> - Jetzt anfragen →
      </a>
    </div>
    
    <script>
      // Room Selection Logic - als globale Funktion für WordPress-Kompatibilität
      window.superbowlSelectRoom_${packageData.id} = function(roomType) {
        const selectedRoom = roomType;
        const priceDouble = ${packageData.price};
        const priceSingle = ${packageData.price + packageData.singleSupplement};
        const packageId = '${packageData.id}';
        const nights = ${packageData.nights};
        const personCount = Number(document.getElementById('person-count')?.value || 2);
        
  // Update UI
  const roomDouble = document.getElementById('room-double');
  const roomSingle = document.getElementById('room-single');
  const isDouble = roomType === 'double';

  roomDouble.classList.toggle('selected', isDouble);
  roomSingle.classList.toggle('selected', !isDouble);

  // Reset inline styles so only the selected option stays highlighted
  roomDouble.style.borderColor = isDouble ? '#1d4ed8' : '#d1d5db';
  roomDouble.style.background = isDouble ? '#dbeafe' : '#ffffff';
  roomSingle.style.borderColor = isDouble ? '#d1d5db' : '#1d4ed8';
  roomSingle.style.background = isDouble ? '#ffffff' : '#dbeafe';
        
  // Update price display
  const basePrice = roomType === 'double' ? priceDouble : priceSingle;
  const price = basePrice;
        const priceDisplay = document.getElementById('price-display');
        priceDisplay.textContent = price.toLocaleString('de-CH') + ' €';
        
        // Update room label
        const roomLabel = roomType === 'double' ? 'Doppelzimmer' : 'Einzelzimmer';
    document.getElementById('room-label').textContent = roomLabel;
    document.getElementById('room-type-text').textContent = roomLabel;
    document.getElementById('selected-room-label').textContent = roomLabel;
        
        // Update CTA links with URL parameters
  const bookingUrl = '${bookingUrl}' + '&room=' + roomType + '&price=' + price + '&nights=' + nights + '&persons=' + personCount;
        document.getElementById('booking-cta').href = bookingUrl;
        document.getElementById('sticky-booking-link').href = bookingUrl;
        document.getElementById('sticky-price').textContent = price.toLocaleString('de-CH') + ' €';
        
        // Animate price change
        priceDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => {
          priceDisplay.style.transform = 'scale(1)';
        }, 200);
      };

      window.superbowlSelectPersons_${packageData.id} = function(count) {
        const roomType = document.getElementById('room-double').classList.contains('selected') ? 'double' : 'single';
        const priceDouble = ${packageData.price};
        const priceSingle = ${packageData.price + packageData.singleSupplement};
        const packageId = '${packageData.id}';
        const nights = ${packageData.nights};
        const persons = Number(count);

        const price = roomType === 'double' ? priceDouble : priceSingle;
        document.getElementById('price-display').textContent = price.toLocaleString('de-CH') + ' €';

        const bookingUrl = '${bookingUrl}' + '&room=' + roomType + '&price=' + price + '&nights=' + nights + '&persons=' + persons;
        document.getElementById('booking-cta').href = bookingUrl;
        document.getElementById('sticky-booking-link').href = bookingUrl;

        const hint = document.getElementById('person-hint');
        if (hint) {
          hint.textContent = persons + ' Personen ausgewählt';
        }
      };
      
      // Sticky CTA on scroll
      window.addEventListener('scroll', function() {
        const stickyCta = document.getElementById('sticky-cta');
        const card = document.querySelector('.superbowl-package-card');
        
        if (card) {
          const cardRect = card.getBoundingClientRect();
          const isCardVisible = cardRect.bottom > 0 && cardRect.top < window.innerHeight;
          
          // Show sticky CTA when card is out of view
          stickyCta.style.display = !isCardVisible && window.scrollY > 300 ? 'block' : 'none';
        }
      });
    </script>
    
    <!-- Schema.org JSON-LD -->
    <script type="application/ld+json">
      ${JSON.stringify(productSchema)}
    </script>
  `;

  // JSON-Antwort mit HTML und Daten
  return NextResponse.json({
    success: true,
    data: packageData,
    html: html,
    schema: productSchema
  });
}
