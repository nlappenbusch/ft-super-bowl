import { NextResponse } from 'next/server';
import { generateProductSchema } from '@/lib/schema';

export async function GET() {
  const packageData = {
    id: 'dream_hollywood',
    packageName: 'Ticket- & Hotel-Package',
    stars: 4,
    nights: 4,
    price: 8950,
    singleSupplement: 1485,
    title: 'Dream Hollywood, by Hyatt',
    description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
    hotel: 'Dream Hollywood, by Hyatt',
    popular: true,
    availableSpots: 12,
    rating: 4.8,
    reviews: 156,
    includes: [
      { type: 'ticket', name: 'Super Bowl LXI Premium Ticket', category: '500er Level (Lower Bowl)', status: 'OK', icon: '🎟️', description: 'Offizielles NFL Premium-Ticket mit VIP-Zugang' },
      { type: 'hotel', name: 'Dream Hollywood, by Hyatt', category: '4-Sterne Superior', status: 'OK', icon: '🏨', description: 'Boutique-Hotel mit Rooftop-Pool und Hollywood Sign Blick' },
      { type: 'transfer', name: 'Flughafen-Hotel-Stadium Transfers', category: 'Hin- und Rückfahrt', status: 'OK', icon: '🚐', description: 'Komfortable Shuttles zu allen wichtigen Locations' },
      { type: 'hospitality', name: 'VIP Pregame-Party', category: 'Inkl. Catering & Getränke', status: 'OK', icon: '🍾', description: 'Exklusiver Zugang zur offiziellen Pregame-Party' }
    ],
    extensionNights: 'Verlängerungsnächte auf Anfrage gegen Aufpreis buchbar'
  };

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
        background: #e8f4fd !important;
        border-color: #184a7b !important;
        border-width: 2px !important;
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
    
    <div class="superbowl-package-card" style="max-width: 900px; margin: 0 auto; border: 2px solid #184a7b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; position: relative;">
      <!-- PHASE 1: Klare Package-Kommunikation -->
      <div style="background: linear-gradient(135deg, #f14624 0%, #d63d1f 100%); color: white; padding: 14px 24px; text-align: center;">
        <div style="font-weight: bold; font-size: 17px; margin-bottom: 4px;">⭐ ${packageData.packageName}</div>
        <div style="font-size: 13px; opacity: 0.95;">Event-Ticket + Hotel + Transfers + VIP-Zugang</div>
      </div>
      
      <!-- Availability Badge -->
      <div class="availability-badge" style="position: absolute; top: 70px; right: 20px; background: rgba(241,70,36,0.95); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;">
        ⏰ Nur noch ${packageData.availableSpots} Plätze verfügbar
      </div>
      
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
        
        <!-- PHASE 1: Leistungsaufschlüsselung -->
        <div style="background: #f8f9fa; border-left: 4px solid #184a7b; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-weight: 700; font-size: 17px; color: #184a7b; margin-bottom: 18px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 24px;">📦</span>
            <span>Vollständige Leistungsaufschlüsselung</span>
          </div>
          
          <div style="display: grid; gap: 14px;">
            ${packageData.includes.map(item => `
              <div style="display: flex; align-items: start; gap: 14px; padding: 14px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; transition: all 0.2s;" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
                <div style="font-size: 28px; flex-shrink: 0; line-height: 1;">${item.icon}</div>
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #1f2937; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-bottom: 2px;">${item.category}</div>
                  <div style="font-size: 12px; color: #9ca3af; font-style: italic;">${item.description}</div>
                </div>
                <span style="background: ${item.status === 'OK' ? '#dcfce7' : '#fef3c7'}; color: ${item.status === 'OK' ? '#15803d' : '#92400e'}; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">${item.status}</span>
              </div>
            `).join('')}
          </div>
          
          <div style="margin-top: 16px; padding: 14px; background: #fef3c7; border-radius: 6px; border-left: 3px solid #f59e0b;">
            <div style="font-size: 12px; color: #92400e; font-weight: 600;">
              📌 Status-Legende: <strong>OK</strong> = sofort verfügbar & buchbar | <strong>RQ</strong> = auf Anfrage
            </div>
          </div>
        </div>
        
        <!-- Room Type Selection (Interactive) -->
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">
            Wählen Sie Ihre Zimmerkategorie:
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
            <!-- Doppelzimmer Option -->
            <div class="room-option selected" id="room-double" onclick="window.superbowlSelectRoom_${packageData.id}('double')" 
                 style="border: 2px solid #184a7b; border-radius: 8px; padding: 16px; background: #e8f4fd; cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 600; color: #184a7b; font-size: 16px;">🛏️ Doppelzimmer</div>
                  <div style="font-size: 13px; color: #666; margin-top: 4px;">${packageData.nights} Nächte</div>
                </div>
                <div style="font-size: 20px; font-weight: bold; color: #184a7b;">
                  ${packageData.price.toLocaleString('de-CH')} €
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
                <div style="font-size: 20px; font-weight: bold; color: #184a7b;">
                  ${(packageData.price + packageData.singleSupplement).toLocaleString('de-CH')} €
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
            
            <a id="booking-cta" href="https://superbowl.faltintravel.com/booking?package=${packageData.id}&room=double&price=${packageData.price}&nights=${packageData.nights}" 
               style="display: inline-block; background: #f14624; color: white; padding: 18px 36px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 18px; transition: all 0.3s; box-shadow: 0 4px 12px rgba(241,70,36,0.25);"
               onmouseover="this.style.background='#d63d1f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(241,70,36,0.35)';"
               onmouseout="this.style.background='#f14624'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(241,70,36,0.25)';">
              Verbindliche Buchungsanfrage senden →
            </a>
            
            <!-- PHASE 1: Verbindlichkeitshinweis -->
            <div style="margin-top: 14px; padding: 14px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 6px; font-size: 12px; color: #7f1d1d; line-height: 1.6;">
              <strong style="display: block; margin-bottom: 6px;">⚠️ Wichtiger Hinweis zur Verbindlichkeit:</strong>
              Die Buchungsanfrage ist <strong>verbindlich</strong>. Bei Verfügbarkeit wird die Buchung fest reserviert. Sollte die gewünschte Leistung nicht verfügbar sein, unterbreiten wir Ihnen umgehend eine gleichwertige Alternative.
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
    <div id="sticky-cta" class="cta-sticky">
      <a id="sticky-booking-link" href="https://superbowl.faltintravel.com/booking?package=${packageData.id}&room=double&price=${packageData.price}&nights=${packageData.nights}"
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
        
        // Update UI
        document.getElementById('room-double').classList.toggle('selected', roomType === 'double');
        document.getElementById('room-single').classList.toggle('selected', roomType === 'single');
        
        // Update price display
        const price = roomType === 'double' ? priceDouble : priceSingle;
        const priceDisplay = document.getElementById('price-display');
        priceDisplay.textContent = price.toLocaleString('de-CH') + ' €';
        
        // Update room label
        const roomLabel = roomType === 'double' ? 'Doppelzimmer' : 'Einzelzimmer';
        document.getElementById('room-label').textContent = roomLabel;
        document.getElementById('room-type-text').textContent = roomLabel;
        
        // Update CTA links with URL parameters
        const bookingUrl = 'https://superbowl.faltintravel.com/booking?package=' + packageId + '&room=' + roomType + '&price=' + price + '&nights=' + nights;
        document.getElementById('booking-cta').href = bookingUrl;
        document.getElementById('sticky-booking-link').href = bookingUrl;
        document.getElementById('sticky-price').textContent = price.toLocaleString('de-CH') + ' €';
        
        // Animate price change
        priceDisplay.style.transform = 'scale(1.1)';
        setTimeout(() => {
          priceDisplay.style.transform = 'scale(1)';
        }, 200);
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
      ${JSON.stringify(generateProductSchema())}
    </script>
  `;

  // JSON-Antwort mit HTML und Daten
  return NextResponse.json({
    success: true,
    data: packageData,
    html: html,
    schema: generateProductSchema()
  });
}
