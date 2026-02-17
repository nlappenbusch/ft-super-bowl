import { Suspense } from 'react';
import BookingForm from '@/components/BookingForm';
import EkomiScripts from '@/components/EkomiScripts';

export default function BookingPage() {
  return (
    <>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Lädt...</p>
          </div>
        </div>
      }>
        <BookingForm />
      </Suspense>
      <EkomiScripts />
    </>
  );
}
