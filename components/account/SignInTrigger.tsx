import React, { useState } from 'react';
import SignInModal from './SignInModal';

/**
 * Wraps any trigger element so clicking it opens the self-owned sign-in modal.
 * Drop-in replacement for Clerk's <SignInButton mode="modal">.
 */
const SignInTrigger: React.FC<{
  children: React.ReactElement;
  onSignedIn?: () => void;
}> = ({ children, onSignedIn }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {React.cloneElement(children, { onClick: () => setOpen(true) })}
      {open && <SignInModal onClose={() => setOpen(false)} onSignedIn={onSignedIn} />}
    </>
  );
};

export default SignInTrigger;
