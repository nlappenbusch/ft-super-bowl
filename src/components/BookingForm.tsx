'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Star, Hotel, Calendar, Users, ChevronDown, CheckCircle2, Phone, Mail, ArrowLeft, Bed, AlertCircle, UserCircle, UserCheck } from 'lucide-react';
import 'flag-icons/css/flag-icons.min.css';
import EkomiWidget from '@/components/EkomiWidget';

interface Traveler {
  salutation: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  passportNumber?: string;
}

interface BookingFormData {
  packageId: string;
  startDate: string;
  doubleRooms: number;
  singleRooms: number;
  numberOfPersons: number;
  travelers: Traveler[];
  // Phase 2: Hauptanmelder-Felder (erweitert)
  mainBookerSalutation: string;
  mainBookerFirstName: string;
  mainBookerLastName: string;
  mainBookerBirthDate: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  mainBookerIsTraveler?: boolean;
  email: string;
  phone: string;
  message: string;
  acceptPrivacy: boolean;
  acceptTerms: boolean;
}

const defaultPackage = { 
  id: 'dream-hollywood', 
  stars: 4, 
  nights: 4, 
  price: 8950, 
  title: 'Dream Hollywood, by Hyatt',
  singleSurcharge: 1485
};

// Room configuration presets based on number of persons
const roomPresets: Record<number, Array<{ label: string; doubleRooms: number; singleRooms: number }>> = {
  1: [
    { label: '1 × Einzelzimmer', doubleRooms: 0, singleRooms: 1 }
  ],
  2: [
    { label: '1 × Doppelzimmer', doubleRooms: 1, singleRooms: 0 },
    { label: '2 × Einzelzimmer', doubleRooms: 0, singleRooms: 2 }
  ],
  3: [
    { label: '1 × Doppelzimmer + 1 × Einzelzimmer', doubleRooms: 1, singleRooms: 1 },
    { label: '3 × Einzelzimmer', doubleRooms: 0, singleRooms: 3 }
  ],
  4: [
    { label: '2 × Doppelzimmer', doubleRooms: 2, singleRooms: 0 },
    { label: '1 × Doppelzimmer + 2 × Einzelzimmer', doubleRooms: 1, singleRooms: 2 },
    { label: '4 × Einzelzimmer', doubleRooms: 0, singleRooms: 4 }
  ],
  5: [
    { label: '1 × Doppelzimmer + 3 × Einzelzimmer', doubleRooms: 1, singleRooms: 3 },
    { label: '2 × Doppelzimmer + 1 × Einzelzimmer', doubleRooms: 2, singleRooms: 1 },
    { label: '5 × Einzelzimmer', doubleRooms: 0, singleRooms: 5 }
  ],
  6: [
    { label: '3 × Doppelzimmer', doubleRooms: 3, singleRooms: 0 },
    { label: '2 × Doppelzimmer + 2 × Einzelzimmer', doubleRooms: 2, singleRooms: 2 },
    { label: '1 × Doppelzimmer + 4 × Einzelzimmer', doubleRooms: 1, singleRooms: 4 },
    { label: '6 × Einzelzimmer', doubleRooms: 0, singleRooms: 6 }
  ],
  7: [
    { label: '3 × Doppelzimmer + 1 × Einzelzimmer', doubleRooms: 3, singleRooms: 1 },
    { label: '2 × Doppelzimmer + 3 × Einzelzimmer', doubleRooms: 2, singleRooms: 3 },
    { label: '7 × Einzelzimmer', doubleRooms: 0, singleRooms: 7 }
  ],
  8: [
    { label: '4 × Doppelzimmer', doubleRooms: 4, singleRooms: 0 },
    { label: '3 × Doppelzimmer + 2 × Einzelzimmer', doubleRooms: 3, singleRooms: 2 },
    { label: '2 × Doppelzimmer + 4 × Einzelzimmer', doubleRooms: 2, singleRooms: 4 },
    { label: '8 × Einzelzimmer', doubleRooms: 0, singleRooms: 8 }
  ],
  9: [
    { label: '4 × Doppelzimmer + 1 × Einzelzimmer', doubleRooms: 4, singleRooms: 1 },
    { label: '3 × Doppelzimmer + 3 × Einzelzimmer', doubleRooms: 3, singleRooms: 3 },
    { label: '9 × Einzelzimmer', doubleRooms: 0, singleRooms: 9 }
  ],
  10: [
    { label: '5 × Doppelzimmer', doubleRooms: 5, singleRooms: 0 },
    { label: '4 × Doppelzimmer + 2 × Einzelzimmer', doubleRooms: 4, singleRooms: 2 },
    { label: '3 × Doppelzimmer + 4 × Einzelzimmer', doubleRooms: 3, singleRooms: 4 },
    { label: '10 × Einzelzimmer', doubleRooms: 0, singleRooms: 10 }
  ]
};

const faqItems = [
  {
    question: 'Sind meine Plätze nebeneinander?',
    answer: 'Ja, bei Buchungen werden die Sitzplätze im gleichen Block reserviert.'
  },
  {
    question: 'Wie kann ich bezahlen?',
    answer: 'Zahlung per Überweisung auf unser Schweizer Bankkonto (CHF oder EUR möglich).'
  },
  {
    question: 'Was ist das Hospitality-Package?',
    answer: 'Das Package beinhaltet VIP-Eingang, offizielle Pregame-Party mit Catering & Getränken, Live-Entertainment und reservierte Sitzplätze im 500er Level.'
  }
];

export default function BookingForm() {
  const searchParams = useSearchParams();
  const [selectedPackage, setSelectedPackage] = useState(defaultPackage);
  const [eventSlug, setEventSlug] = useState('');
  const [packageSlug, setPackageSlug] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [numberOfPersons, setNumberOfPersons] = useState(2);
  const [roomValidation, setRoomValidation] = useState({ valid: true, message: '' });
  const [selectedPreset, setSelectedPreset] = useState<string>('0'); // Index of selected preset
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainBookerIsTraveler, setMainBookerIsTraveler] = useState(false); // NEW: Auto-fill first traveler
  const [phonePrefix, setPhonePrefix] = useState('+41'); // Phone country code
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false); // Custom dropdown state
  const [isMounted, setIsMounted] = useState(false); // Fix hydration error for dynamic widgets
  
  const phoneCountries = [
    { code: 'ch', prefix: '+41', name: 'CH' },
    { code: 'de', prefix: '+49', name: 'DE' },
    { code: 'at', prefix: '+43', name: 'AT' },
    { code: 'li', prefix: '+423', name: 'LI' },
    { code: 'fr', prefix: '+33', name: 'FR' },
    { code: 'it', prefix: '+39', name: 'IT' },
    { code: 'nl', prefix: '+31', name: 'NL' },
    { code: 'be', prefix: '+32', name: 'BE' },
    { code: 'lu', prefix: '+352', name: 'LU' },
  ];
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BookingFormData>({
    defaultValues: {
      packageId: defaultPackage.id,
      startDate: '',
      doubleRooms: 1,
      singleRooms: 0,
      numberOfPersons: 2,
      travelers: Array(2).fill({ salutation: '', firstName: '', lastName: '', birthDate: '', passportNumber: '' })
    }
  });

  const watchDoubleRooms = watch('doubleRooms');
  const watchSingleRooms = watch('singleRooms');
  const watchNumberOfPersons = watch('numberOfPersons');

  useEffect(() => {
    const eventParam = searchParams.get('event') || '';
    const packageParam = searchParams.get('package') || '';
    setEventSlug(eventParam);
    setPackageSlug(packageParam);

    const loadPackage = async () => {
      try {
        const response = await fetch(`/api/package?event=${encodeURIComponent(eventParam)}&package=${encodeURIComponent(packageParam)}`);
        const result = await response.json();
        if (result?.success && result?.data) {
          const pkg = result.data as {
            id?: string;
            stars?: number;
            nights?: number;
            price?: number;
            title?: string;
            singleSupplement?: number;
          };
          setSelectedPackage({
            id: pkg.id || packageParam,
            stars: pkg.stars || defaultPackage.stars,
            nights: pkg.nights || defaultPackage.nights,
            price: Number(pkg.price || defaultPackage.price),
            title: pkg.title || defaultPackage.title,
            singleSurcharge: Number(pkg.singleSupplement || defaultPackage.singleSurcharge)
          });
          setValue('packageId', packageParam);
        }
      } catch (error) {
        console.error('Package load error:', error);
      }
    };

    loadPackage();
  }, [searchParams, setValue]);

  // Initialize form from URL parameters (from Package Card)
  useEffect(() => {
    if (isInitialized) return;
    
    const roomParam = searchParams.get('room'); // 'double' or 'single'
    const personsParam = searchParams.get('persons'); // NEW: number of persons

    if ((roomParam || personsParam) && !isInitialized) {
      const persons = personsParam ? parseInt(personsParam) : (roomParam === 'single' ? 1 : 2);
      
      if (roomParam === 'single') {
        // Einzelzimmer selected
        setValue('numberOfPersons', persons);
        setValue('doubleRooms', 0);
        setValue('singleRooms', persons);
        setValue('travelers', Array(persons).fill({ salutation: '', firstName: '', lastName: '', birthDate: '', passportNumber: '' }));
        setNumberOfPersons(persons);
        setSelectedPreset('0');
      } else if (roomParam === 'double') {
        // Doppelzimmer selected
        setValue('numberOfPersons', persons);
        // Smart room allocation based on person count
        const doubleRooms = Math.floor(persons / 2);
        const singleRooms = persons % 2;
        setValue('doubleRooms', doubleRooms);
        setValue('singleRooms', singleRooms);
        setValue('travelers', Array(persons).fill({ salutation: '', firstName: '', lastName: '', birthDate: '', passportNumber: '' }));
        setNumberOfPersons(persons);
        setSelectedPreset('0');
      } else if (personsParam) {
        // Only persons specified, use default room config
        setValue('numberOfPersons', persons);
        const doubleRooms = Math.floor(persons / 2);
        const singleRooms = persons % 2;
        setValue('doubleRooms', doubleRooms);
        setValue('singleRooms', singleRooms);
        setValue('travelers', Array(persons).fill({ salutation: '', firstName: '', lastName: '', birthDate: '', passportNumber: '' }));
        setNumberOfPersons(persons);
        setSelectedPreset('0');
      }
      setIsInitialized(true);
    }
  }, [searchParams, setValue, isInitialized]);

  useEffect(() => {
    const persons = Number(watchNumberOfPersons) || 2;
    setNumberOfPersons(persons);
    
    // Auto-select first preset when person count changes
    const presets = roomPresets[persons];
    if (presets && presets.length > 0) {
      setSelectedPreset('0');
      setValue('doubleRooms', presets[0].doubleRooms);
      setValue('singleRooms', presets[0].singleRooms);
    }
  }, [watchNumberOfPersons, setValue]);

  // Handle preset selection
  const handlePresetChange = (presetIndex: string) => {
    setSelectedPreset(presetIndex);
    const presets = roomPresets[numberOfPersons];
    if (presets && presets[Number(presetIndex)]) {
      const preset = presets[Number(presetIndex)];
      setValue('doubleRooms', preset.doubleRooms);
      setValue('singleRooms', preset.singleRooms);
    }
  };

  // Validate room configuration
  useEffect(() => {
    const doubleRooms = Number(watchDoubleRooms) || 0;
    const singleRooms = Number(watchSingleRooms) || 0;
    const totalBeds = (doubleRooms * 2) + singleRooms;
    const totalRooms = doubleRooms + singleRooms;

    if (totalRooms === 0) {
      setRoomValidation({ valid: false, message: 'Bitte mindestens 1 Zimmer auswählen' });
    } else if (totalBeds < numberOfPersons) {
      setRoomValidation({ 
        valid: false, 
        message: `⚠️ Nicht genug Betten! ${numberOfPersons} Personen benötigen ${totalBeds < numberOfPersons ? numberOfPersons - totalBeds : 0} weitere(s) Bett(en)` 
      });
    } else if (totalBeds > numberOfPersons) {
      setRoomValidation({ 
        valid: true, 
        message: `ℹ️ ${totalBeds - numberOfPersons} freie(s) Bett(en)` 
      });
    } else {
      setRoomValidation({ valid: true, message: '✓ Perfekte Aufteilung' });
    }
  }, [watchDoubleRooms, watchSingleRooms, numberOfPersons]);

  // NEW: Auto-fill first traveler when checkbox is activated
  const watchStreet = watch('street');
  const watchCity = watch('city');
  const watchZip = watch('zip');
  const watchCountry = watch('country');

  const handleMainBookerCheckbox = (checked: boolean) => {
    setMainBookerIsTraveler(checked);
    // Auto-fill will happen in the form through the checkbox value
  };

  // Close phone dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.phone-dropdown-container')) {
        setIsPhoneDropdownOpen(false);
      }
    };

    if (isPhoneDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isPhoneDropdownOpen]);

  // Fix hydration error by only rendering dynamic widgets on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const calculateTotal = () => {
    const doubleRooms = Number(watchDoubleRooms) || 0;
    const singleRooms = Number(watchSingleRooms) || 0;
    
    const doubleRoomCost = doubleRooms * 2 * selectedPackage.price;
    const singleRoomCost = singleRooms * (selectedPackage.price + selectedPackage.singleSurcharge);
    
    return doubleRoomCost + singleRoomCost;
  };

  const onSubmit = async (data: BookingFormData) => {
    if (!roomValidation.valid) {
      alert('Bitte überprüfen Sie Ihre Zimmerkonfiguration!');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventSlug,
          packageSlug,
          packageId: data.packageId,
          packageTitle: selectedPackage.title,
          startDate: data.startDate,
          numberOfPersons: data.numberOfPersons,
          doubleRooms: data.doubleRooms,
          singleRooms: data.singleRooms,
          travelers: data.travelers,
          salutation: data.mainBookerSalutation,
          firstName: data.mainBookerFirstName,
          lastName: data.mainBookerLastName,
          email: data.email,
          phone: data.phone,
          message: data.message,
          totalPrice: calculateTotal(),
          consent: data.acceptTerms && data.acceptPrivacy
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Vielen Dank für Ihre Buchungsanfrage! Wir werden uns in Kürze bei Ihnen melden.');
        // Optionally redirect to thank you page
        // window.location.href = '/danke';
      } else {
        alert('❌ Fehler beim Absenden: ' + result.error);
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('❌ Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Back to Package Button */}
      <div className='bg-linear-to-r from-orange-500 to-orange-600 shadow-md'>
        <div className='container mx-auto px-4 py-3'>
          <a 
          href={eventSlug ? `/events/${eventSlug}` : '/'}
            className='inline-flex items-center gap-2 text-white font-semibold hover:gap-3 transition-all duration-200'
          >
            <ArrowLeft className='w-5 h-5' />
            <span>Zurück zur Package-Übersicht</span>
          </a>
        </div>
      </div>

      <div className='container mx-auto px-4 py-8 max-w-6xl'>
        <div className='grid lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-2'>
            <div className='bg-white rounded-xl shadow-lg p-6 md:p-8'>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Buchung: {selectedPackage.title}
              </h1>
              <p className='text-gray-600 mb-8'>
                Bitte Formular ausfüllen - wir melden uns in Kürze
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
                <div className='p-4 rounded-lg bg-gray-50 border border-gray-200'>
                  <div className='flex items-center gap-2 mb-2 text-gray-900'>
                    <Calendar className='w-5 h-5' style={{ color: '#184a7b' }} />
                    <div>
                      <div className='font-semibold'>Reisezeitraum</div>
                      <div className='text-sm text-gray-500'>Gemäß gewähltem Package</div>
                    </div>
                  </div>
                  {/* Phase 2: Verlängerungsnächte-Hinweis */}
                  <div className='mt-3 pt-3 border-t border-gray-300'>
                    <div className='flex items-start gap-2 text-sm text-gray-700'>
                      <span className='text-base'>ℹ️</span>
                      <span><strong>Verlängerungsnächte</strong> auf Anfrage gegen Aufpreis buchbar</span>
                    </div>
                  </div>
                  <input type='hidden' {...register('startDate')} />
                  <input type='hidden' {...register('packageId')} />
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>
                    Anzahl Reisende *
                  </label>
                  <div className='relative'>
                    <Users className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
                    <select {...register('numberOfPersons', { required: true, min: 1 })} className='w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'Person' : 'Personen'}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className='p-6 rounded-xl bg-gray-50 border border-gray-200'>
                  <div className='flex items-center gap-2 mb-4'>
                    <Bed className='w-5 h-5' style={{ color: '#184a7b' }} />
                    <label className='text-lg font-bold text-gray-900'>Zimmeraufteilung *</label>
                  </div>
                  
                  <p className='text-sm text-gray-600 mb-4'>Wählen Sie eine passende Zimmerkombination:</p>
                  
                  <div className='space-y-3 mb-4'>
                    {roomPresets[numberOfPersons]?.map((preset, index) => {
                      const totalPrice = (preset.doubleRooms * 2 * selectedPackage.price) + 
                                        (preset.singleRooms * (selectedPackage.price + selectedPackage.singleSurcharge));
                      const isSelected = selectedPreset === String(index);
                      
                      return (
                        <label
                          key={index}
                          style={isSelected ? { borderColor: '#184a7b', backgroundColor: '#e8f2f9' } : {}}
                          className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            isSelected 
                              ? 'shadow-md' 
                              : 'border-gray-300 bg-white hover:shadow-sm'
                          }`}
                          onMouseEnter={(e) => !isSelected && (e.currentTarget.style.borderColor = '#184a7b')}
                          onMouseLeave={(e) => !isSelected && (e.currentTarget.style.borderColor = '')}
                          onClick={() => handlePresetChange(String(index))}
                        >
                          <div className='flex items-start gap-3 flex-1'>
                            <input
                              type='radio'
                              name='roomPreset'
                              value={index}
                              checked={isSelected}
                              onChange={() => handlePresetChange(String(index))}
                              className='mt-1 w-4 h-4 text-blue-600'
                            />
                            <div className='flex-1'>
                              <div className='flex items-center gap-2 mb-1'>
                                <div className='font-semibold text-gray-900'>{preset.label}</div>
                                {index === 0 && (
                                  <span className='px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full'>
                                    ⭐ EMPFOHLEN
                                  </span>
                                )}
                              </div>
                              <div className='flex flex-wrap gap-3 text-xs text-gray-600'>
                                {preset.doubleRooms > 0 && (
                                  <div className='flex items-center gap-1'>
                                    <Bed className='w-3.5 h-3.5' />
                                    <span>{preset.doubleRooms} DZ × {selectedPackage.price.toLocaleString('de-DE')} € × 2</span>
                                  </div>
                                )}
                                {preset.singleRooms > 0 && (
                                  <div className='flex items-center gap-1'>
                                    <Bed className='w-3.5 h-3.5' />
                                    <span>{preset.singleRooms} EZ × {(selectedPackage.price + selectedPackage.singleSurcharge).toLocaleString('de-DE')} €</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className='text-right ml-4'>
                            <div className='font-bold text-lg' style={{ color: '#184a7b' }}>{totalPrice.toLocaleString('de-DE')} €</div>
                            <div className='text-xs text-gray-500'>Gesamt</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Hidden inputs to maintain form state */}
                  <input type='hidden' {...register('doubleRooms')} />
                  <input type='hidden' {...register('singleRooms')} />

                  <div className={`p-4 rounded-lg border-2 ${roomValidation.valid ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                    <div className='flex items-start gap-2'>
                      <AlertCircle className={`w-5 h-5 mt-0.5 shrink-0 ${roomValidation.valid ? 'text-green-600' : 'text-amber-600'}`} />
                      <div className='flex-1'>
                        <p className={`text-sm font-semibold ${roomValidation.valid ? 'text-green-900' : 'text-amber-900'}`}>
                          {roomValidation.message}
                        </p>
                        <p className='text-xs text-gray-600 mt-1'>
                          Gesamt: {Number(watchDoubleRooms) || 0} DZ + {Number(watchSingleRooms) || 0} EZ = {((Number(watchDoubleRooms) || 0) * 2) + (Number(watchSingleRooms) || 0)} Betten für {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NEUE STRUKTUR: Hauptanmelder ZUERST */}
                <div className='border-t-4 pt-8' style={{ borderColor: '#184a7b' }}>
                  <div className='flex items-center gap-3 mb-6'>
                    <UserCheck className='w-7 h-7' style={{ color: '#184a7b' }} />
                    <div>
                      <h3 className='text-2xl font-bold text-gray-900'>Hauptanmelder / Rechnungsempfänger</h3>
                      <p className='text-sm text-gray-600'>Ihre Kontakt- und Rechnungsdaten</p>
                    </div>
                  </div>

                  <div className='space-y-4 p-6 rounded-xl bg-gray-50 border border-gray-200'>
                    {/* Persönliche Daten */}
                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-2'>Anrede *</label>
                      <select {...register('mainBookerSalutation', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500'>
                        <option value=''>Bitte wählen</option>
                        <option value='herr'>Herr</option>
                        <option value='frau'>Frau</option>
                        <option value='divers'>Divers</option>
                      </select>
                      {errors.mainBookerSalutation && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                    </div>

                    <div className='grid md:grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Vorname *</label>
                        <input type='text' {...register('mainBookerFirstName', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Max' />
                        {errors.mainBookerFirstName && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Nachname *</label>
                        <input type='text' {...register('mainBookerLastName', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Mustermann' />
                        {errors.mainBookerLastName && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                      </div>
                    </div>

                    <div className='grid md:grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Geburtsdatum *</label>
                        <input type='date' {...register('mainBookerBirthDate', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' />
                        {errors.mainBookerBirthDate && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>E-Mail *</label>
                        <div className='relative'>
                          <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
                          <input type='email' {...register('email', { required: true, pattern: /^\S+@\S+$/i })} className='w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='max@example.com' />
                        </div>
                        {errors.email && <span className='text-red-500 text-sm'>Gültige E-Mail erforderlich</span>}
                      </div>
                    </div>

                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-2'>Telefon *</label>
                      <div className='grid grid-cols-3 gap-2'>
                        {/* Custom Dropdown für Flaggen */}
                        <div className='relative phone-dropdown-container'>
                          <button
                            type='button'
                            onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                            className='w-full px-3 py-3 border border-gray-300 rounded-lg bg-white text-left flex items-center gap-2'
                          >
                            <img 
                              src={`https://flagcdn.com/w20/${phoneCountries.find(c => c.prefix === phonePrefix)?.code}.png`}
                              alt=''
                              className='w-5 h-auto'
                            />
                            <span className='text-sm'>{phonePrefix}</span>
                          </button>
                          
                          {isPhoneDropdownOpen && (
                            <div className='absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto'>
                              {phoneCountries.map((country) => (
                                <button
                                  key={country.prefix}
                                  type='button'
                                  onClick={() => {
                                    setPhonePrefix(country.prefix);
                                    setIsPhoneDropdownOpen(false);
                                  }}
                                  className='w-full px-3 py-2 hover:bg-gray-100 flex items-center gap-2 text-left'
                                >
                                  <img 
                                    src={`https://flagcdn.com/w20/${country.code}.png`}
                                    alt={country.name}
                                    className='w-5 h-auto'
                                  />
                                  <span className='text-sm'>{country.name} {country.prefix}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className='col-span-2 relative'>
                          <Phone className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
                          <input type='tel' {...register('phone', { required: true })} className='w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='79 123 45 67' />
                        </div>
                      </div>
                      {errors.phone && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                    </div>

                    {/* Adresse */}
                    <div className='pt-4 border-t border-gray-300'>
                      <h4 className='font-semibold text-gray-900 mb-4'>Rechnungsadresse</h4>
                      
                      <div className='space-y-4'>
                        <div>
                          <label className='block text-sm font-semibold text-gray-700 mb-2'>Straße & Hausnummer *</label>
                          <input type='text' {...register('street', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Musterstraße 123' />
                          {errors.street && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                        </div>
                        
                        <div className='grid md:grid-cols-3 gap-4'>
                          <div>
                            <label className='block text-sm font-semibold text-gray-700 mb-2'>PLZ *</label>
                            <input type='text' {...register('zip', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='8000' />
                            {errors.zip && <span className='text-red-500 text-sm'>Pflicht</span>}
                          </div>
                          <div className='md:col-span-2'>
                            <label className='block text-sm font-semibold text-gray-700 mb-2'>Ort *</label>
                            <input type='text' {...register('city', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Zürich' />
                            {errors.city && <span className='text-red-500 text-sm'>Pflicht</span>}
                          </div>
                        </div>
                        
                        <div>
                          <label className='block text-sm font-semibold text-gray-700 mb-2'>Land *</label>
                          <select {...register('country', { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500'>
                            <option value=''>Bitte wählen...</option>
                            <option value='CH'>Schweiz</option>
                            <option value='DE'>Deutschland</option>
                            <option value='AT'>Österreich</option>
                            <option value='LI'>Liechtenstein</option>
                            <option value='FR'>Frankreich</option>
                            <option value='IT'>Italien</option>
                            <option value='NL'>Niederlande</option>
                            <option value='BE'>Belgien</option>
                            <option value='LU'>Luxemburg</option>
                            <option value='other'>Anderes Land</option>
                          </select>
                          {errors.country && <span className='text-red-500 text-sm'>Pflichtfeld</span>}
                        </div>
                      </div>
                    </div>

                    {/* Checkbox: Ich bin auch Reisender */}
                    <div className='pt-4 border-t border-gray-300'>
                      <div className='flex items-start gap-3 p-4 bg-white rounded-lg border-2 border-gray-300'>
                        <input 
                          type='checkbox' 
                          id='mainBookerIsTraveler'
                          checked={mainBookerIsTraveler}
                          onChange={(e) => handleMainBookerCheckbox(e.target.checked)}
                          style={{ accentColor: '#184a7b' }} 
                          className='mt-1 w-5 h-5 border-gray-300 rounded cursor-pointer' 
                        />
                        <label htmlFor='mainBookerIsTraveler' className='cursor-pointer'>
                          <div className='font-semibold text-gray-900'>✓ Ich bin auch Reisender</div>
                          <p className='text-xs text-gray-600 mt-1'>Ihre Daten werden automatisch als erster Reisender übernommen</p>
                        </label>
                      </div>
                    </div>

                    {/* Nachricht (optional) */}
                    <div className='pt-4'>
                      <label className='block text-sm font-semibold text-gray-700 mb-2'>Nachricht (optional)</label>
                      <textarea 
                        {...register('message')} 
                        rows={4} 
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' 
                        placeholder='Besondere Wünsche, Fragen oder Anmerkungen...' 
                      />
                    </div>
                  </div>
                </div>

                {/* Reisende-Section */}
                <div className='border-t-4 pt-8' style={{ borderColor: '#f14624' }}>
                  <div className='flex items-center gap-3 mb-6'>
                    <Users className='w-7 h-7' style={{ color: '#f14624' }} />
                    <div>
                      <h3 className='text-2xl font-bold text-gray-900'>
                        {mainBookerIsTraveler ? 'Weitere Reisende' : 'Reisende'}
                      </h3>
                      <p className='text-sm text-gray-600'>
                        {mainBookerIsTraveler 
                          ? `Daten der weiteren ${numberOfPersons - 1} Reisenden` 
                          : `Daten aller ${numberOfPersons} Reisenden`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {Array.from({ length: numberOfPersons }).map((_, index) => {
                  // Skip first traveler if main booker is also traveler
                  if (index === 0 && mainBookerIsTraveler) return null;
                  
                  const displayNumber = mainBookerIsTraveler ? index + 1 : index + 1;
                  
                  return (
                  <div key={index} className='p-6 bg-gray-50 rounded-lg space-y-4'>
                    <div className='flex items-center gap-2 mb-2'>
                      <UserCircle className='w-5 h-5 text-gray-600' />
                      <h4 className='font-semibold text-gray-900'>Reisende {displayNumber}</h4>
                    </div>
                    
                    <div>
                      <label className='block text-sm font-semibold text-gray-700 mb-2'>Anrede *</label>
                      <select {...register(`travelers.${index}.salutation`, { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white'>
                        <option value=''>Bitte wählen</option>
                        <option value='herr'>Herr</option>
                        <option value='frau'>Frau</option>
                        <option value='divers'>Divers</option>
                      </select>
                    </div>
                    <div className='grid md:grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Vorname *</label>
                        <input type='text' {...register(`travelers.${index}.firstName`, { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Wie im Reisepass' />
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Nachname *</label>
                        <input type='text' {...register(`travelers.${index}.lastName`, { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Wie im Reisepass' />
                      </div>
                    </div>
                    <div className='grid md:grid-cols-2 gap-4'>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Geburtsdatum *</label>
                        <input type='date' {...register(`travelers.${index}.birthDate`, { required: true })} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' />
                      </div>
                      <div>
                        <label className='block text-sm font-semibold text-gray-700 mb-2'>Passnummer (optional)</label>
                        <input type='text' {...register(`travelers.${index}.passportNumber`)} className='w-full px-4 py-3 border border-gray-300 rounded-lg bg-white' placeholder='Falls vorhanden' />
                      </div>
                    </div>
                  </div>
                  );
                })}

                {/* AGB & Privacy */}
                <div className='space-y-3 pt-6'>
                    <label className='flex items-start gap-3 cursor-pointer'>
                      <input type='checkbox' {...register('acceptTerms', { required: true })} style={{ accentColor: '#184a7b' }} className='mt-1 w-4 h-4 border-gray-300 rounded' />
                      <span className='text-sm text-gray-700'>
                        Ich habe die <a href='https://faltintravel.com/allgemeine-geschaeftsbedingungen/' target='_blank' rel='noopener noreferrer' style={{ color: '#184a7b' }} className='hover:underline font-semibold' onClick={(e) => e.stopPropagation()}>Allgemeinen Geschäftsbedingungen (AGB)</a> gelesen und akzeptiere diese. *
                      </span>
                    </label>
                    {errors.acceptTerms && <span className='text-red-500 text-sm block ml-7'>Pflichtfeld</span>}
                    
                    <label className='flex items-start gap-3 cursor-pointer'>
                      <input type='checkbox' {...register('acceptPrivacy', { required: true })} style={{ accentColor: '#184a7b' }} className='mt-1 w-4 h-4 border-gray-300 rounded' />
                      <span className='text-sm text-gray-700'>
                        Ich habe die <a href='https://faltintravel.com/datenschutzerklaerung/' target='_blank' rel='noopener noreferrer' style={{ color: '#184a7b' }} className='hover:underline font-semibold' onClick={(e) => e.stopPropagation()}>Datenschutzerklärung</a> gelesen und akzeptiere diese. *
                      </span>
                    </label>
                    {errors.acceptPrivacy && <span className='text-red-500 text-sm block ml-7'>Pflichtfeld</span>}
                </div>

                <button 
                  type='submit' 
                  style={{ 
                    backgroundColor: isSubmitHovered ? '#d63d1f' : '#f14624',
                    transform: isSubmitHovered ? 'translateY(-2px)' : 'translateY(0)',
                    boxShadow: isSubmitHovered ? '0 10px 25px rgba(241, 70, 36, 0.3)' : 'none',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={() => setIsSubmitHovered(true)}
                  onMouseLeave={() => setIsSubmitHovered(false)}
                  className='w-full text-white font-bold py-4 px-6 rounded-lg text-lg shadow-lg'
                >
                  Verbindliche Buchungsanfrage senden →
                </button>
                
                {/* Phase 2: Verbindlichkeitshinweis */}
                <div className='mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-md'>
                  <div className='flex items-start gap-3'>
                    <AlertCircle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' />
                    <div className='text-sm text-red-900'>
                      <p className='font-semibold mb-1'>⚠️ Wichtiger Hinweis zur Verbindlichkeit:</p>
                      <p className='text-red-800'>Die Buchungsanfrage ist <strong>verbindlich</strong>. Bei Verfügbarkeit wird die Buchung fest reserviert. Sollte die gewünschte Leistung nicht verfügbar sein, unterbreiten wir Ihnen umgehend eine gleichwertige Alternative.</p>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className='lg:col-span-1'>
            <div className='bg-white rounded-xl shadow-lg p-6 mb-6 sticky top-4'>
              <h3 className='text-xl font-bold text-gray-900 mb-4'>Ihre Auswahl</h3>
              <div className='space-y-4 mb-6'>
                <div className='flex items-center justify-between pb-3 border-b'>
                  <div>
                    <div className='flex items-center gap-2 mb-1'>
                      <Hotel className='w-4 h-4' style={{ color: '#184a7b' }} />
                      <span className='font-semibold text-gray-900'>{selectedPackage.title}</span>
                    </div>
                    <div className='flex items-center gap-1'>
                      {[...Array(selectedPackage.stars)].map((_, i) => (
                        <Star key={i} className='w-3 h-3 fill-yellow-400 text-yellow-400' />
                      ))}
                    </div>
                  </div>
                </div>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Anzahl Personen:</span>
                    <span className='font-semibold'>{numberOfPersons}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Doppelzimmer:</span>
                    <span className='font-semibold'>{Number(watchDoubleRooms) || 0} DZ</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600'>Einzelzimmer:</span>
                    <span className='font-semibold'>{Number(watchSingleRooms) || 0} EZ</span>
                  </div>
                  <div className='flex justify-between pt-2 border-t'>
                    <span className='text-gray-600'>Gesamt Zimmer:</span>
                    <span className='font-semibold'>{(Number(watchDoubleRooms) || 0) + (Number(watchSingleRooms) || 0)}</span>
                  </div>
                </div>
                <div className='pt-3 border-t'>
                  <div className='space-y-1 text-xs text-gray-600 mb-3'>
                    {(Number(watchDoubleRooms) || 0) > 0 && (
                      <div className='flex justify-between'>
                        <span>{Number(watchDoubleRooms)} DZ × 2 × {selectedPackage.price.toLocaleString('de-DE')} €</span>
                        <span className='font-semibold'>{((Number(watchDoubleRooms) || 0) * 2 * selectedPackage.price).toLocaleString('de-DE')} €</span>
                      </div>
                    )}
                    {(Number(watchSingleRooms) || 0) > 0 && (
                      <div className='flex justify-between'>
                        <span>{Number(watchSingleRooms)} EZ × {(selectedPackage.price + selectedPackage.singleSurcharge).toLocaleString('de-DE')} €</span>
                        <span className='font-semibold'>{((Number(watchSingleRooms) || 0) * (selectedPackage.price + selectedPackage.singleSurcharge)).toLocaleString('de-DE')} €</span>
                      </div>
                    )}
                  </div>
                  <div className='flex justify-between items-center'>
                    <span className='text-lg font-bold text-gray-900'>Gesamt:</span>
                    <span className='text-2xl font-bold' style={{ color: '#184a7b' }}>{calculateTotal().toLocaleString('de-DE')} €</span>
                  </div>
                  <p className='text-xs text-gray-500 mt-1'>
                    * {(Number(watchDoubleRooms) || 0) + (Number(watchSingleRooms) || 0)} {((Number(watchDoubleRooms) || 0) + (Number(watchSingleRooms) || 0)) === 1 ? 'Zimmer' : 'Zimmer'}, {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'}
                  </p>
                </div>
              </div>
              <div style={{ backgroundColor: '#e8f2f9' }} className='rounded-lg p-4'>
                <div className='flex items-start gap-2'>
                  <CheckCircle2 className='w-5 h-5 shrink-0 mt-0.5' style={{ color: '#184a7b' }} />
                  <div className='text-sm text-gray-700'>
                    <p className='font-semibold mb-1'>Inklusive:</p>
                    <ul className='space-y-1 text-xs'>
                      <li> Hospitality Super Bowl Ticket</li>
                      <li> 4 Hotelübernachtungen</li>
                      <li> Pregame-Party mit Catering</li>
                      <li> Schweizer Reisegarantie</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* eKomi Trust Badge */}
              <div className='mt-6 bg-white rounded-lg p-4 shadow-sm'>
                <p className='text-xs text-gray-600 text-center mb-3 font-semibold'>Vertrauen Sie auf Faltin Travel</p>
                {isMounted && (
                  <EkomiWidget token="sf11936169930865af963" className='min-h-[66px]' />
                )}
                <a href="https://www.ekomi.de/bewertungen-faltintravelcom.html" target="_blank" rel="noopener noreferrer">
                  <img alt="faltintravel.com Reviews with ekomi.de" src="https://smart-widget-assets.ekomiapps.de/resources/ekomi_logo.png" style={{ display: 'none' }}/>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* FAQs Section */}
        <div className='mt-12 max-w-4xl mx-auto'>
          <h2 className='text-3xl font-bold text-gray-900 mb-8 text-center'>Häufig gestellte Fragen</h2>
          <div className='space-y-4'>
            {faqItems.map((faq, index) => (
              <div key={index} className='bg-white rounded-lg shadow-md overflow-hidden'>
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className='w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition'
                >
                  <span className='font-semibold text-gray-900'>{faq.question}</span>
                  <ChevronDown 
                    className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${openFaq === index ? 'transform rotate-180' : ''}`}
                  />
                </button>
                {openFaq === index && (
                  <div className='px-6 pb-4 text-gray-700 border-t border-gray-100 pt-4'>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
