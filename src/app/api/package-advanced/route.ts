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
    travelPeriod: 'Do. 11.02. – Mo. 15.02.2027',
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
    availableSpots: 12,
    soldOut: false,
    rating: 4.8,
    reviews: 156,
    includes: [
      { type: 'ticket', name: 'Super Bowl LXI Premium Ticket', category: '500er Level (Lower Bowl)', status: 'OK', icon: '🎟️', description: 'Offizielles NFL Premium-Ticket mit VIP-Zugang' },
      { type: 'hotel', name: 'Dream Hollywood, by Hyatt', category: '4-Sterne Superior', status: 'OK', icon: '🏨', description: 'Boutique-Hotel mit Rooftop-Pool und Hollywood Sign Blick' },
      { type: 'transfer', name: 'Flughafen-Hotel-Stadium Transfers', category: 'Hin- und Rückfahrt', status: 'OK', icon: '🚐', description: 'Komfortable Shuttles zu allen wichtigen Locations' },
      { type: 'hospitality', name: 'VIP Pregame-Party', category: 'Inkl. Catering & Getränke', status: 'OK', icon: '🍾', description: 'Exklusiver Zugang zur offiziellen Pregame-Party' }
    ],
    extensionNights: 'Verlängerungsnächte auf Anfrage gegen Aufpreis buchbar',
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
        text-align: left;
      }

      .superbowl-package-card h3,
      .superbowl-package-card h4 {
        text-align: left;
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

      .room-option .room-title,
      .room-option .room-price {
        color: #1f2937;
      }
      
      .room-option:hover {
        background: #fff4ee !important;
        border-color: #f14624 !important;
        transform: translateY(-2px);
      }
      
      .room-option.selected {
        background: #fff0e8 !important;
        border-color: #f14624 !important;
        border-width: 2px !important;
      }

      .room-option.selected::before {
        content: none !important;
      }

      .room-option.selected .room-title,
      .room-option.selected .room-price {
        color: #f14624 !important;
      }

      .room-option .selected-badge {
        display: none;
        background: #f14624;
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
      }
      
      .sb-pkg {
        animation: fadeIn 0.6s ease-out;
      }
      
      .sb-badge {
        animation: pulse 2s infinite;
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
    
    <div class="superbowl-package-card" id="superbowl-package-card-${packageData.id}" style="max-width: 900px; margin: 0 auto; border: 2px solid #184a7b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; position: relative;">
      <!-- PHASE 1: Klare Package-Kommunikation -->
      <div style="background: linear-gradient(135deg, #f14624 0%, #d63d1f 100%); color: white; padding: 14px 24px; text-align: center;">
        <div style="font-weight: bold; font-size: 17px; margin-bottom: 4px;">⭐ ${packageData.packageName}</div>
        <div style="font-size: 13px; opacity: 0.95;">Event-Ticket + Hotel + Transfers + VIP-Zugang</div>
      </div>
      
      <!-- Kontingent-Badge: Ausgebucht bei 0, knappe Plätze ohne Zahl, sonst nichts -->
      ${packageData.soldOut ? `
      <div style="position: absolute; top: 100px; right: 20px; background: rgba(20,48,71,0.95); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;">
        Ausgebucht
      </div>` : packageData.availableSpots > 0 && packageData.availableSpots <= 10 ? `
      <div class="availability-badge" style="position: absolute; top: 100px; right: 20px; background: rgba(241,70,36,0.95); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;">
        ⏰ Nur noch wenige Plätze verfügbar
      </div>` : ''}
      
      <div style="padding: 32px;">
        
        <div style="margin-bottom: 24px;">
          <h3 style="font-size: 28px; font-weight: bold; color: #184a7b; margin: 0 0 8px 0;">
            ${packageData.title}
          </h3>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="color: #fbbf24; font-size: 16px;">★★★★★</span>
            <span style="font-size: 14px; color: #666; font-weight: 600;">${packageData.rating}/5</span>
            <span style="font-size: 13px; color: #999;">(${packageData.reviews} Bewertungen)</span>
          </div>
        </div>

        <!-- Hero Section: Beschreibung + Bilder -->
        <div style="display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 20px; margin-bottom: 28px;">
          <div>
            <div style="font-size: 15px; color: #4b5563; line-height: 1.6; margin-bottom: 14px;">
              ${packageData.description}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <span style="background: #e0f2fe; color: #0369a1; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">Ticket Kategorie 1</span>
              <span style="background: #ede9fe; color: #6d28d9; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">Transfers inklusive</span>
              <span style="background: #dcfce7; color: #15803d; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">VIP Betreuung</span>
            </div>
            <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
              <span style="background: #f1f5f9; color: #475569; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">🚌 LAX: ${packageData.distances.airport}</span>
              <span style="background: #f1f5f9; color: #475569; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">🏟️ Stadium: ${packageData.distances.stadium}</span>
              <span style="background: #f1f5f9; color: #475569; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 600;">🌆 Downtown: ${packageData.distances.downtown}</span>
            </div>
          </div>
          <div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              ${packageData.hotelImages.map((src) => `
                <img src="${src}" alt="${packageData.hotel}" style="width: 100%; height: 72px; object-fit: cover; border-radius: 6px;" />
              `).join('')}
            </div>
          </div>
        </div>
        
        <!-- PHASE 1: Package-Leistungen (Elegant & Clean) -->
        <div style="margin-bottom: 32px;">
          <h4 style="font-weight: 700; font-size: 20px; color: #184a7b; margin-bottom: 20px;">
            Im Package enthalten:
          </h4>

          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px;">
            <span style="background: #fee2e2; color: #b91c1c; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 700;">Event-Ticket inkl. Kategorie</span>
            <span style="background: #dbeafe; color: #1d4ed8; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 700;">Hotelkategorie inkl. Frühstück</span>
            <span style="background: #dcfce7; color: #15803d; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 700;">Transfers & Betreuung</span>
            <span style="background: #fef3c7; color: #b45309; font-size: 12px; padding: 6px 10px; border-radius: 999px; font-weight: 700;">Zusatzleistungen auf Anfrage</span>
          </div>
          
          <div style="display: grid; gap: 20px;">
            ${packageData.includes.map(item => `
              <div style="display: flex; align-items: start; gap: 16px;">
                <div style="font-size: 32px; flex-shrink: 0; line-height: 1;">${item.icon}</div>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #1f2937; font-size: 16px; margin-bottom: 6px;">${item.name}</div>
                  <div style="font-size: 14px; color: #6b7280; line-height: 1.5;">${item.description}</div>
                </div>
                <div style="color: #10b981; font-size: 24px; flex-shrink: 0; line-height: 1;">✓</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Room Type Selection (Interactive) -->
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">
            Wählen Sie Ihre Zimmerkategorie:
          </div>

          <div style="margin-bottom: 12px; font-size: 13px; color: #666;">
            Aktuelle Auswahl: <span id="selected-room-label-${packageData.id}" style="font-weight: 700; color: #f14624;">Doppelzimmer</span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
            <!-- Doppelzimmer Option -->
            <div class="room-option selected" id="room-double-${packageData.id}" onclick="window.superbowlSelectRoom_${packageData.id}('double')" 
          style="border: 2px solid #f14624; border-radius: 8px; padding: 16px; background: #fff0e8; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="room-title" style="font-weight: 600; font-size: 16px;">🛏️ Doppelzimmer</div>
                  <div style="font-size: 13px; color: #666; margin-top: 4px;">${packageData.nights} Nächte</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                  <span class="selected-badge">Ausgewählt</span>
                  <div class="room-price" style="font-size: 20px; font-weight: bold;">
                    ${packageData.price.toLocaleString('de-CH')} €
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Einzelzimmer Option -->
                <div class="room-option" id="room-single-${packageData.id}" onclick="window.superbowlSelectRoom_${packageData.id}('single')" 
                style="border: 2px solid #d1d5db; border-radius: 8px; padding: 16px; background: white; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="room-title" style="font-weight: 600; font-size: 16px;">🛏️ Einzelzimmer</div>
                  <div style="font-size: 13px; color: #666; margin-top: 4px;">${packageData.nights} Nächte</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                  <span class="selected-badge">Ausgewählt</span>
                  <div class="room-price" style="font-size: 20px; font-weight: bold;">
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
              <div style="font-weight: 600; color: #333;">${packageData.nights}x im <span id="room-type-text-${packageData.id}">Doppelzimmer</span></div>
            </div>
          </div>
        </div>
        
        <!-- Price & CTA -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
            <div>
              <div id="price-display-${packageData.id}" class="price-update" style="font-size: 36px; font-weight: bold; color: #184a7b;">
                ab ${packageData.price.toLocaleString('de-CH')} €
              </div>
              <div style="font-size: 14px; color: #666;">pro Person im <span id="room-label-${packageData.id}">Doppelzimmer</span></div>
              <div id="total-price-${packageData.id}" style="margin-top: 6px; font-size: 14px; color: #1f2937; font-weight: 600;">
                Gesamtpreis für 2 Personen: ${(packageData.price * 2).toLocaleString('de-CH')} €
              </div>
              <div style="margin-top: 4px; font-size: 12px; color: #64748b;">
                Hinweis: Preis pro Person &times; Personenanzahl (Zimmerwahl wirkt sich auf den Einzelzimmerpreis aus)
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label for="person-count-${packageData.id}" style="font-size: 12px; color: #6b7280; font-weight: 600;">Personen auswählen</label>
              <select id="person-count-${packageData.id}" onchange="window.superbowlSelectPersons_${packageData.id}(this.value)" style="padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-weight: 600;">
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
            </div>
            
${packageData.soldOut ? `
            <div style="display: inline-block; background: #e2e8f0; color: #64748b; padding: 16px 32px; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: not-allowed;">Ausgebucht – nicht mehr buchbar</div>` : `
            <a id="booking-cta-${packageData.id}" href="${bookingUrl}&room=double&price=${packageData.price}&nights=${packageData.nights}" 
               style="display: inline-block; background: #f14624; color: white; padding: 18px 36px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 18px; transition: all 0.3s; box-shadow: 0 4px 12px rgba(241,70,36,0.25);"
               onmouseover="this.style.background='#d63d1f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(241,70,36,0.35)';"
               onmouseout="this.style.background='#f14624'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(241,70,36,0.25)';">
              Weiter zur Buchungsanfrage →
            </a>`}
            
            <!-- PHASE 1: Verbindlichkeitshinweis -->
            <div style="margin-top: 14px; padding: 14px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 6px; font-size: 12px; color: #7f1d1d; line-height: 1.6;">
              <strong style="display: block; margin-bottom: 6px;">ℹ️ Nächster Schritt:</strong>
              Nach Klick gelangen Sie zur Zimmerbelegung und weiteren Angaben. Erst dort wird die <strong>verbindliche</strong> Anfrage final bestätigt.
            </div>
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
    ${packageData.soldOut ? '' : `<div id="sticky-cta-${packageData.id}" class="cta-sticky">
      <a id="sticky-booking-link-${packageData.id}" href="${bookingUrl}&room=double&price=${packageData.price}&nights=${packageData.nights}"
         style="display: block; background: #f14624; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); text-align: center;"
         onmouseover="this.style.background='#d63d1f'"
         onmouseout="this.style.background='#f14624'">
        <span id="sticky-price-${packageData.id}">${packageData.price.toLocaleString('de-CH')} €</span> - Weiter zur Buchungsanfrage →
      </a>
    </div>`}
    
    <script>
      // Room Selection Logic - als globale Funktion für WordPress-Kompatibilität
      window.superbowlSelectRoom_${packageData.id} = function(roomType) {
        const selectedRoom = roomType;
        const priceDouble = ${packageData.price};
        const priceSingle = ${packageData.price + packageData.singleSupplement};
        const packageId = '${packageData.id}';
        const nights = ${packageData.nights};
        const personCount = Number(document.getElementById('person-count-${packageData.id}')?.value || 2);
        
        // Update UI
        const roomDouble = document.getElementById('room-double-${packageData.id}');
        const roomSingle = document.getElementById('room-single-${packageData.id}');
        const isDouble = roomType === 'double';
        
        roomDouble.classList.toggle('selected', isDouble);
        roomSingle.classList.toggle('selected', !isDouble);
        
        // Reset inline styles so only the selected option stays highlighted
  roomDouble.style.borderColor = isDouble ? '#f14624' : '#d1d5db';
  roomDouble.style.borderWidth = '2px';
  roomDouble.style.background = isDouble ? '#fff0e8' : '#ffffff';
  roomSingle.style.borderColor = isDouble ? '#d1d5db' : '#f14624';
  roomSingle.style.borderWidth = '2px';
  roomSingle.style.background = isDouble ? '#ffffff' : '#fff0e8';
        
  // Update price display
  const price = roomType === 'double' ? priceDouble : priceSingle;
        const priceDisplay = document.getElementById('price-display-${packageData.id}');
        priceDisplay.textContent = 'ab ' + price.toLocaleString('de-CH') + ' €';

        const totalPrice = document.getElementById('total-price-${packageData.id}');
        if (totalPrice) {
          totalPrice.textContent = 'Gesamtpreis für ' + personCount + ' Personen: ' + (price * personCount).toLocaleString('de-CH') + ' €';
        }
        
        // Update room label
        const roomLabel = roomType === 'double' ? 'Doppelzimmer' : 'Einzelzimmer';
        document.getElementById('room-label-${packageData.id}').textContent = roomLabel;
        document.getElementById('room-type-text-${packageData.id}').textContent = roomLabel;
        const selectionLabel = document.getElementById('selected-room-label-${packageData.id}');
        if (selectionLabel) {
          selectionLabel.textContent = roomLabel;
        }
        
        // Update CTA links with URL parameters
  const bookingUrl = '${bookingUrl}' + '&room=' + roomType + '&price=' + price + '&nights=' + nights + '&persons=' + personCount;
        const ctaEl = document.getElementById('booking-cta-${packageData.id}');
        if (ctaEl) ctaEl.href = bookingUrl;
        const stickyLinkEl = document.getElementById('sticky-booking-link-${packageData.id}');
        if (stickyLinkEl) stickyLinkEl.href = bookingUrl;
        const stickyPriceEl = document.getElementById('sticky-price-${packageData.id}');
        if (stickyPriceEl) stickyPriceEl.textContent = price.toLocaleString('de-CH') + ' €';
        
        // Animate price change
        priceDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => {
          priceDisplay.style.transform = 'scale(1)';
        }, 200);
      };

      window.superbowlSelectPersons_${packageData.id} = function(count) {
        const roomType = document.getElementById('room-double-${packageData.id}').classList.contains('selected') ? 'double' : 'single';
        const priceDouble = ${packageData.price};
        const priceSingle = ${packageData.price + packageData.singleSupplement};
        const packageId = '${packageData.id}';
        const nights = ${packageData.nights};
        const persons = Number(count);

        const price = roomType === 'double' ? priceDouble : priceSingle;
        document.getElementById('price-display-${packageData.id}').textContent = 'ab ' + price.toLocaleString('de-CH') + ' €';

        const totalPrice = document.getElementById('total-price-${packageData.id}');
        if (totalPrice) {
          totalPrice.textContent = 'Gesamtpreis für ' + persons + ' Personen: ' + (price * persons).toLocaleString('de-CH') + ' €';
        }

        const bookingUrl = '${bookingUrl}' + '&room=' + roomType + '&price=' + price + '&nights=' + nights + '&persons=' + persons;
        const ctaEl2 = document.getElementById('booking-cta-${packageData.id}');
        if (ctaEl2) ctaEl2.href = bookingUrl;
        const stickyLinkEl2 = document.getElementById('sticky-booking-link-${packageData.id}');
        if (stickyLinkEl2) stickyLinkEl2.href = bookingUrl;
      };
      
      // Sticky CTA on scroll
      window.addEventListener('scroll', function() {
        const stickyCta = document.getElementById('sticky-cta-${packageData.id}');
        const card = document.getElementById('superbowl-package-card-${packageData.id}');
        
        if (card && stickyCta) {
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
