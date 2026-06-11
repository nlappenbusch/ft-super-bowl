'use client';

import React, { useState } from 'react';
import SuperBowlContent from '@/components/SuperBowlContent';

// Diese Seite simuliert WordPress für lokale Tests
export default function WordPressPreviewPage() {
  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* WordPress Header (Simulation) */}
      <header style={{
        background: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)',
        color: 'white',
        padding: '20px 0',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            🎿 Faltin Travel
          </div>
          <nav style={{ display: 'flex', gap: '30px', fontSize: '14px' }}>
            <a href="/" style={{ color: 'white', textDecoration: 'none' }}>Home</a>
            <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Sportevents</a>
            <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Kulturevents</a>
            <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Über uns</a>
            <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Kontakt</a>
          </nav>
        </div>
      </header>

      {/* WordPress Content Area */}
      <main style={{
        maxWidth: '1200px',
        margin: '40px auto',
        padding: '0 20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '40px' }}>
          {/* Breadcrumb */}
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            <a href="/" style={{ color: '#184a7b', textDecoration: 'none' }}>Home</a> / 
            <a href="/sportevents" style={{ color: '#184a7b', textDecoration: 'none' }}> Sportevents</a> / 
            Super Bowl 2027
          </div>

          {/* WordPress Page Title */}
          <h1 style={{
            fontSize: '36px',
            color: '#184a7b',
            marginBottom: '20px',
            borderBottom: '3px solid #f14624',
            paddingBottom: '15px'
          }}>
            Super Bowl LXI 2027 - Offizielles Hospitality-Package
          </h1>

          {/* WordPress Content (würde ein Editor schreiben) */}
          <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.8' }}>
            Erleben Sie am <strong>7. Februar 2027</strong> das größte Sportevent der Welt 
            live im legendären <strong>SoFi Stadium</strong> in Los Angeles. Unser exklusives 
            Hospitality-Package bietet Ihnen das perfekte Rundum-Sorglos-Paket für ein 
            unvergessliches Super Bowl Erlebnis.
          </p>

          <p style={{ marginBottom: '40px', fontSize: '16px', lineHeight: '1.8' }}>
            Als offizieller Partner bieten wir Ihnen Premium-Tickets kombiniert mit 
            erstklassigen Hotels und VIP-Services. Genießen Sie exklusiven Zugang zur 
            Pregame-Party, Premium-Catering und Live-Entertainment.
          </p>

          {/* Hier würde [superbowl_package] Shortcode stehen */}
          <div style={{ margin: '40px 0' }}>
            <h2 style={{
              fontSize: '28px',
              color: '#184a7b',
              marginBottom: '20px'
            }}>
              Unser Package-Angebot
            </h2>
            
            {/* Package Card Component */}
            <PackageCardInline />
          </div>

          {/* WordPress Content zwischen Shortcodes */}
          <h2 style={{
            fontSize: '28px',
            color: '#184a7b',
            marginTop: '40px',
            marginBottom: '20px'
          }}>
            Was macht unser Package besonders?
          </h2>
          
          <p style={{ marginBottom: '20px', fontSize: '16px', lineHeight: '1.8' }}>
            Bei Faltin Travel profitieren Sie von über 15 Jahren Erfahrung in der 
            Organisation von Sportreisen zu den größten Events weltweit. Alle unsere 
            Packages sind durch die <strong>Schweizer Reisegarantie</strong> abgesichert.
          </p>

          <ul style={{ margin: '20px 0 40px 40px', lineHeight: '2' }}>
            <li>Persönliche Betreuung vor, während und nach der Reise</li>
            <li>Langjährige Partnerschaften mit Premium-Hotels</li>
            <li>Offizielle NFL-Hospitality-Tickets</li>
            <li>Deutschsprachiger Service vor Ort</li>
            <li>Flexible Zahlungskonditionen</li>
          </ul>

          {/* Hier würde [superbowl_faqs] Shortcode stehen */}
          <div style={{ margin: '40px 0' }}>
            <FAQsInline />
          </div>

          {/* WordPress Content am Ende */}
          <h2 style={{
            fontSize: '28px',
            color: '#184a7b',
            marginTop: '40px',
            marginBottom: '20px'
          }}>
            Jetzt buchen und Plätze sichern!
          </h2>
          
          <p style={{ marginBottom: '40px', fontSize: '16px', lineHeight: '1.8' }}>
            Die Verfügbarkeit ist begrenzt. Kontaktieren Sie uns noch heute für ein 
            unverbindliches Angebot oder buchen Sie direkt online.
          </p>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <a href="tel:+41447002277" style={{
              display: 'inline-block',
              background: '#184a7b',
              color: 'white',
              padding: '15px 30px',
              textDecoration: 'none',
              borderRadius: '5px',
              margin: '0 10px',
              fontWeight: 'bold'
            }}>
              📞 +41 44 700 22 77
            </a>
            <a href="mailto:info@faltintravel.com" style={{
              display: 'inline-block',
              background: '#f14624',
              color: 'white',
              padding: '15px 30px',
              textDecoration: 'none',
              borderRadius: '5px',
              margin: '0 10px',
              fontWeight: 'bold'
            }}>
              ✉️ E-Mail senden
            </a>
          </div>
        </div>
      </main>

      {/* WordPress Footer */}
      <footer style={{
        background: '#2c3e50',
        color: 'white',
        padding: '40px 0',
        marginTop: '60px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <p>&copy; 2027 Faltin Travel - Ihr Spezialist für Sportreisen</p>
          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            <a href="/agb" style={{ color: '#ccc', textDecoration: 'none', margin: '0 10px' }}>AGB</a> |
            <a href="/datenschutz" style={{ color: '#ccc', textDecoration: 'none', margin: '0 10px' }}>Datenschutz</a> |
            <a href="/impressum" style={{ color: '#ccc', textDecoration: 'none', margin: '0 10px' }}>Impressum</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Inline Package Card (simuliert [superbowl_package])
function PackageCardInline() {
  const [numberOfPersons, setNumberOfPersons] = useState(2);
  const [isHovered, setIsHovered] = useState(false);

  const packageData = {
    id: 'dream_hollywood',
    title: 'Dream Hollywood, by Hyatt',
    description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
    price: 8950,
    singleSupplement: 1485,
    nights: 4,
    availableSpots: 12,
    rating: 4.8,
    reviews: 156
  };

  const pricePerPerson = packageData.price;
  const estimatedTotal = numberOfPersons * pricePerPerson;
  
  const handlePersonsChange = (persons: number) => {
    setNumberOfPersons(persons);
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      border: '2px solid #184a7b',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      background: 'white',
      position: 'relative'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #f14624 0%, #d63d1f 100%)',
        color: 'white',
        padding: '8px 16px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
      }}>
        ⭐ Offizielles Hospitality-Package
      </div>
      
      {/* Availability Badge */}
      <div style={{
        position: 'absolute',
        top: '50px',
        right: '20px',
        background: 'rgba(241,70,36,0.95)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        animation: 'pulse 2s infinite'
      }}>
        ⏰ Nur noch {packageData.availableSpots} Plätze verfügbar
      </div>
      
      <div style={{ padding: '32px' }}>
        {/* Title & Rating */}
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#184a7b',
            margin: '0 0 8px 0'
          }}>
            {packageData.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#fbbf24' }}>★★★★★</span>
            <span style={{ fontSize: '14px', color: '#666', fontWeight: '600' }}>{packageData.rating}/5</span>
            <span style={{ fontSize: '13px', color: '#999' }}>({packageData.reviews} Bewertungen)</span>
          </div>
        </div>
        
        <p style={{
          color: '#666',
          fontSize: '16px',
          margin: '0 0 24px 0',
          lineHeight: '1.5'
        }}>
          {packageData.description}
        </p>
        
        {/* Person Count Selection */}
        <div style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '2px solid #0ea5e9',
          boxShadow: '0 2px 8px rgba(14,165,233,0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                👥
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                  Wählen Sie die
                </label>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  Anzahl Reisende
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => handlePersonsChange(Math.max(1, numberOfPersons - 1))}
                disabled={numberOfPersons <= 1}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: numberOfPersons <= 1 ? '#e2e8f0' : 'white',
                  color: numberOfPersons <= 1 ? '#94a3b8' : '#0ea5e9',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: numberOfPersons <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: numberOfPersons <= 1 ? 'none' : '0 2px 8px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  if (numberOfPersons > 1) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = numberOfPersons <= 1 ? 'none' : '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                −
              </button>
              
              <div style={{
                minWidth: '160px',
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: '800',
                color: '#0f172a',
                padding: '12px 24px',
                background: 'white',
                borderRadius: '12px',
                border: '3px solid #0ea5e9',
                boxShadow: '0 4px 12px rgba(14,165,233,0.2)'
              }}>
                {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'}
              </div>
              
              <button
                onClick={() => handlePersonsChange(Math.min(10, numberOfPersons + 1))}
                disabled={numberOfPersons >= 10}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: numberOfPersons >= 10 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  cursor: numberOfPersons >= 10 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: numberOfPersons >= 10 ? 'none' : '0 2px 8px rgba(14,165,233,0.3)'
                }}
                onMouseEnter={(e) => {
                  if (numberOfPersons < 10) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,165,233,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = numberOfPersons >= 10 ? 'none' : '0 2px 8px rgba(14,165,233,0.3)';
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
        
        {/* Package Details */}
        <div style={{
          background: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>📅 Reisezeitraum:</div>
              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>12.-16. Februar 2027</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>🏨 Übernachtungen:</div>
              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>{packageData.nights} Nächte im Doppelzimmer</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>🛏️ Zimmerkonfiguration:</div>
              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>Im nächsten Schritt wählbar</div>
            </div>
          </div>
        </div>
        
        {/* Price Section - REDESIGNED */}
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          padding: '28px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '2px solid #e2e8f0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Preis pro Person
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                fontSize: '48px',
                fontWeight: '900',
                color: '#184a7b',
                lineHeight: '1'
              }}>
                {pricePerPerson.toLocaleString('de-CH')} €
              </div>
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>
              pro Person im Doppelzimmer (inkl. alle Leistungen)
            </div>
          </div>

          {numberOfPersons > 1 && (
            <div style={{
              background: 'linear-gradient(135deg, #184a7b 0%, #0f3a5f 100%)',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 4px 16px rgba(24,74,123,0.25)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative Background Pattern */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '120px',
                height: '120px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50%'
              }}></div>
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Gesamtpreis für Ihre Gruppe
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: '900',
                    color: 'white',
                    lineHeight: '1'
                  }}>
                    {estimatedTotal.toLocaleString('de-CH')} €
                  </div>
                  <div style={{
                    fontSize: '16px',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: '600',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '4px 12px',
                    borderRadius: '20px'
                  }}>
                    für {numberOfPersons} Personen
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
                  ✓ Basierend auf Doppelzimmer-Belegung<br/>
                  ✓ Exakte Zimmerkonfiguration im nächsten Schritt
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* CTA Button */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            
            <a 
              href={`/booking?package=${packageData.id}&persons=${numberOfPersons}`}
              style={{
                display: 'inline-block',
                background: isHovered ? '#d63d1f' : '#f14624',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '16px',
                transition: 'all 0.3s',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered ? '0 4px 8px rgba(241,70,36,0.3)' : '0 2px 4px rgba(241,70,36,0.2)'
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              Jetzt für {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'} anfragen →
            </a>
          </div>
        </div>
        
        {/* Trust Elements */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666' }}>
            <span style={{ color: '#10b981' }}>✓</span> Sichere Buchung
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666' }}>
            <span style={{ color: '#10b981' }}>✓</span> Reisegarantie
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666' }}>
            <span style={{ color: '#10b981' }}>✓</span> Kostenlose Beratung
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#666' }}>
            <span style={{ color: '#10b981' }}>✓</span> Flexible Zahlung
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

// Inline FAQs (simuliert [superbowl_faqs])
function FAQsInline() {
  const faqs = [
    {
      q: "Was ist im Hospitality-Package enthalten?",
      a: "Das Hospitality-Package beinhaltet ein Premium-Ticket im 500er Level mit exklusivem Zugang zur Pregame-Party, VIP-Eingang zum Stadion, Premium-Catering, Getränke und Live-Entertainment im Hospitality-Bereich vor dem Spiel."
    },
    {
      q: "Wo befindet sich das Dream Hollywood Hotel?",
      a: "Das Dream Hollywood Hotel liegt im Herzen von Hollywood, nur wenige Minuten vom Hollywood Walk of Fame entfernt. Es verfügt über einen Rooftop-Pool mit Blick auf das berühmte Hollywood Sign."
    },
    {
      q: "Sind die Sitzplätze nebeneinander?",
      a: "Wir bemühen uns, zusammenhängende Sitzplätze zu reservieren. Bei frühzeitiger Buchung können wir dies in der Regel garantieren."
    }
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#184a7b',
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        Häufig gestellte Fragen
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {faqs.map((faq, i) => (
          <details key={i} style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '20px',
            cursor: 'pointer'
          }}>
            <summary style={{
              fontWeight: '600',
              fontSize: '16px',
              color: '#184a7b',
              listStyle: 'none'
            }}>
              {faq.q}
            </summary>
            <p style={{
              marginTop: '15px',
              color: '#666',
              lineHeight: '1.6'
            }}>
              {faq.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
