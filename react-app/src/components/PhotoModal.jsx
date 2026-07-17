import { useEffect } from 'react';
import { useApp } from '../AppContext.jsx';

export default function PhotoModal() {
  const { photoModal, closePhotoModal, setPhotoModal } = useApp();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closePhotoModal(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closePhotoModal]);

  if (!photoModal) return null;
  const { images, index } = photoModal;

  const prev = () => { if (index > 0) setPhotoModal({ images, index: index - 1 }); };
  const next = () => { if (index < images.length - 1) setPhotoModal({ images, index: index + 1 }); };

  return (
    <div className="photo-modal" onClick={closePhotoModal}>
      <div className="photo-modal-inner" onClick={e => e.stopPropagation()}>
        <button className="photo-modal-close" onClick={closePhotoModal}><i className="fa-solid fa-xmark" /></button>
        {images.length > 1 && index > 0 && (
          <button className="photo-modal-arrow left" onClick={(e) => { e.stopPropagation(); prev(); }}><i className="fa-solid fa-chevron-left" /></button>
        )}
        <img src={images[index]} alt="" />
        {images.length > 1 && index < images.length - 1 && (
          <button className="photo-modal-arrow right" onClick={(e) => { e.stopPropagation(); next(); }}><i className="fa-solid fa-chevron-right" /></button>
        )}
        <div className="photo-modal-caption">{`Rasm ${index + 1} / ${images.length}`}</div>
      </div>
    </div>
  );
}
