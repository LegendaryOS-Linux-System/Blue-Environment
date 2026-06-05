import React from 'react';
import type { UserInfo } from '../types';

interface UserCardProps {
  user: UserInfo;
  isSelected: boolean;
  avatarData?: string;
  onClick: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  isSelected,
  avatarData,
  onClick,
}) => {
  const initials = user.realname
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || user.username[0].toUpperCase();

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-300 w-36"
      style={{
        background: isSelected
          ? 'rgba(37,99,235,0.12)'
          : 'rgba(8,20,45,0.4)',
        border: isSelected
          ? '1px solid rgba(59,130,246,0.4)'
          : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isSelected
          ? '0 0 32px rgba(59,130,246,0.15)'
          : 'none',
        transform: isSelected ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Avatar */}
      <div className="relative">
        {avatarData ? (
          <img
            src={avatarData}
            alt={user.username}
            className="w-16 h-16 rounded-full object-cover"
            style={{
              boxShadow: isSelected
                ? '0 0 0 3px #3b82f6, 0 4px 20px rgba(59,130,246,0.4)'
                : '0 0 0 2px rgba(59,130,246,0.2), 0 4px 12px rgba(0,0,0,0.4)',
            }}
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-medium"
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
              boxShadow: isSelected
                ? '0 0 0 3px #3b82f6, 0 4px 20px rgba(59,130,246,0.4)'
                : '0 0 0 2px rgba(59,130,246,0.2), 0 4px 12px rgba(0,0,0,0.4)',
              fontFamily: '"DM Sans", sans-serif',
            }}
          >
            {initials}
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
            style={{
              background: '#3b82f6',
              boxShadow: '0 0 8px rgba(59,130,246,0.8)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <div
          className="text-sm font-medium truncate max-w-full"
          style={{
            color: isSelected ? '#e2e8f0' : '#94a3b8',
            transition: 'color 0.2s',
          }}
        >
          {user.realname}
        </div>
        <div className="text-xs mt-0.5" style={{ color: '#475569' }}>
          {user.username}
        </div>
      </div>
    </button>
  );
};
