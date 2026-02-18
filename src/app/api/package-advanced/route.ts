import { NextResponse } from 'next/server';
import { generateProductSchema } from '@/lib/schema';

export async function GET() {
  const packageData = {
    id: 'dream_hollywood',
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
    reviews: 156
  };

  // HTML für die Advanced Package Card mit Personen-Auswahl
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
      
      .superbowl-package-advanced {
        animation: fadeIn 0.6s ease-out;
      }
      
      .availability-badge {
        animation: pulse 2s infinite;
      }
      
      .person-control {
        display: inline-flex;
        align-items: center;
        gap: 16px;
        background: white;
        padding: 12px 20px;
        border-radius: 12px;
        border: 2px solid #0ea5e9;
      }
      
      .person-btn {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 2px solid #0ea5e9;
        background: white;
        color: #0ea5e9;
        font-size: 20px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .person-btn:hover:not(:disabled) {
        background: #0ea5e9;
        color: white;
        transform: scale(1.1);
      }
      
      .person-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      
      .person-count {
        font-size: 18px;
        font-weight: bold;
        color: #0ea5e9;
        min-width: 80px;
        text-align: center;
      }
      
      .price-highlight {
        transition: all 0.3s ease;
      }
      
      @media (max-width: 768px) {
        .person-control {
          width: 100%;
          justify-content: center;
        }
      }
    </style>
    
    <div class="superbowl-package-advanced" style="max-width: 800px; margin: 0 auto; border: 2px solid #184a7b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background: white; position: relative;">
      ${packageData.popular ? `
        <div style="background: linear-gradient(135deg, #f14624 0%, #d63d1f 100%); color: white; padding: 8px 16px; text-align: center; font-weight: bold; font-size: 14px;">
          ⭐ Offizielles Hospitality-Package
        </div>
      ` : ''}
      
      <!-- Availability Badge -->
      <div class="availability-badge" style="position: absolute; top: 20px; right: 20px; background: rgba(241,70,36,0.95); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 10;">
        ⏰ Nur noch ${packageData.availableSpots} Plätze verfügbar
      </div>
      
      <div style="padding: 32px;">
        <!-- Title & Rating -->
        <div style="margin-bottom: 12px;">
          <h3 style="font-size: 28px; font-weight: bold; color: #184a7b; margin: 0 0 8px 0;">
            ${packageData.title}
          </h3>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #fbbf24;">★★★★★</span>
            <span style="font-size: 14px; color: #666; font-weight: 600;">${packageData.rating}/5</span>
            <span style="font-size: 13px; color: #999;">(${packageData.reviews} Bewertungen)</span>
          </div>
        </div>
        
        <p style="color: #666; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;">
          ${packageData.description}
        </p>
        
        <!-- Person Count Selection -->
        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; border: 2px solid #0ea5e9; box-shadow: 0 2px 8px rgba(14,165,233,0.15);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                👥
              </div>
              <div>
                <div style="font-weight: 600; color: #0369a1; font-size: 14px; margin-bottom: 4px;">Wählen Sie die</div>
                <div style="font-weight: 700; color: #0369a1; font-size: 16px;">Anzahl Reisende</div>
              </div>
            </div>
            
            <div class="person-control">
              <button class="person-btn" id="btn-decrease" onclick="window.changePersonCount('decrease')">−</button>
              <div class="person-count" id="person-display">2 Personen</div>
              <button class="person-btn" id="btn-increase" onclick="window.changePersonCount('increase')">+</button>
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
              <div style="font-weight: 600; color: #333;">${packageData.nights} Nächte im Doppelzimmer</div>
            </div>
            <div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">🛏️ Zimmerkonfiguration:</div>
              <div style="font-weight: 600; color: #333;">Im nächsten Schritt wählbar</div>
            </div>
          </div>
        </div>
        
        <!-- Price & CTA -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px;">
            <!-- Price per Person -->
            <div>
              <div style="font-size: 14px; color: #666; margin-bottom: 8px;">Preis pro Person</div>
              <div style="font-size: 32px; font-weight: bold; color: #184a7b;">
                ${packageData.price.toLocaleString('de-CH')} €
              </div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">pro Person im Doppelzimmer (inkl. alle Leistungen)</div>
            </div>
            
            <!-- Total Price -->
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 16px; border-radius: 8px; border: 2px solid #0ea5e9;">
              <div style="font-size: 14px; color: #0369a1; margin-bottom: 8px; font-weight: 600;">Gesamtpreis für Ihre Gruppe</div>
              <div id="total-price" class="price-highlight" style="font-size: 36px; font-weight: bold; color: #0369a1;">
                ${(packageData.price * 2).toLocaleString('de-CH')} €
              </div>
              <div style="font-size: 13px; color: #0369a1; margin-top: 4px;">für <span id="total-persons">2 Personen</span></div>
            </div>
          </div>
          
          <!-- Important Notes -->
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; font-size: 13px; color: #92400e;">
            <div style="font-weight: 600; margin-bottom: 4px;">✓ Basierend auf Doppelzimmer-Belegung</div>
            <div>✓ Exakte Zimmerkonfiguration im nächsten Schritt</div>
          </div>
          
          <a id="booking-cta" href="https://superbowl.faltintravel.com/booking?package=${packageData.id}&persons=2&price=${packageData.price}&nights=${packageData.nights}" 
             style="display: block; background: #f14624; color: white; padding: 18px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px; text-align: center; transition: all 0.3s; box-shadow: 0 2px 4px rgba(241,70,36,0.2);"
             onmouseover="this.style.background='#d63d1f'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(241,70,36,0.3)';"
             onmouseout="this.style.background='#f14624'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(241,70,36,0.2)';">
            Jetzt für <span id="cta-persons">2 Personen</span> anfragen →
          </a>
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
    
    <script>
      // Person Count Logic - Global Function
      window.changePersonCount = function(action) {
        const currentCount = window.sbPersonCount || 2;
        let newCount = currentCount;
        
        if (action === 'increase' && currentCount < 20) {
          newCount = currentCount + 1;
        } else if (action === 'decrease' && currentCount > 1) {
          newCount = currentCount - 1;
        }
        
        if (newCount !== currentCount) {
          window.sbPersonCount = newCount;
          updateDisplay(newCount);
        }
      };
      
      function updateDisplay(count) {
        const pricePerPerson = ${packageData.price};
        const totalPrice = pricePerPerson * count;
        
        // Update person count display
        document.getElementById('person-display').textContent = count + (count === 1 ? ' Person' : ' Personen');
        document.getElementById('total-persons').textContent = count + (count === 1 ? ' Person' : ' Personen');
        document.getElementById('cta-persons').textContent = count + (count === 1 ? ' Person' : ' Personen');
        
        // Update total price
        const totalPriceEl = document.getElementById('total-price');
        totalPriceEl.textContent = totalPrice.toLocaleString('de-CH') + ' €';
        
        // Animate price change
        totalPriceEl.style.transform = 'scale(1.1)';
        setTimeout(() => {
          totalPriceEl.style.transform = 'scale(1)';
        }, 200);
        
        // Update CTA link
        const bookingUrl = 'https://superbowl.faltintravel.com/booking?package=${packageData.id}&persons=' + count + '&price=' + pricePerPerson + '&nights=${packageData.nights}';
        document.getElementById('booking-cta').href = bookingUrl;
        
        // Update button states
        document.getElementById('btn-decrease').disabled = count <= 1;
        document.getElementById('btn-increase').disabled = count >= 20;
      }
      
      // Initialize
      window.sbPersonCount = 2;
      updateDisplay(2);
    </script>
    
    <!-- Schema.org JSON-LD -->
    <script type="application/ld+json">
      ${JSON.stringify(generateProductSchema())}
    </script>
  `;

  return NextResponse.json({
    success: true,
    data: packageData,
    html: html,
    schema: generateProductSchema()
  });
}
