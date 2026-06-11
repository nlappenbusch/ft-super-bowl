'use client';

import Link from 'next/link';
import { useState } from 'react';

interface CTAButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function CTAButton({ href, children, className = '' }: CTAButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link 
      href={href}
      className={`inline-block text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 ${className}`}
      style={{ 
        backgroundColor: isHovered ? '#d63d1f' : '#f14624',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 10px 25px rgba(241, 70, 36, 0.3)' : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </Link>
  );
}
