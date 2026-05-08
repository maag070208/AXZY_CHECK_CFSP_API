export const E2E_MEDIA_PHOTOS = [
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_10_20260506182854.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_10_20260506194454.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_10_20260506194500.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_5_20260506182058.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_5_20260506182532.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_5_20260506182614.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_6_20260506182750.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_7_20260506182829.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_8_20260506182842.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro__rea_Com_n_9_20260506182907.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Acceso_Principal_20260506181836.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Acceso_Principal_20260506181841.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Acceso_Principal_20260506181846.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_incident_20260506192753.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_maintenance_20260506194557.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_maintenance_20260506195001.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Parque_4_20260506192442.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Parque_5_20260506192355.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Parque_5_20260506192401.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_Parque_para_Mascotas_20260506192420.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_resident_ine_20260420172508.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/aamaro_resident_ine_20260420172517.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260420175547.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260420175555.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260423232219.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260423232224.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260423232228.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260428014300.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/admin_resident_ine_20260428014306.jpg",
  "https://bonaterrta-s3-bucket-prod.s3.us-east-2.amazonaws.com/ANGEL_SALAZAR_B1_1_Pasillo1_20260507190855.jpg",
];

export const E2E_MEDIA_VIDEOS = [
  "https://cfsp-s3-bucket-prod.s3.us-east-2.amazonaws.com/Plaza_2000/rondas/Plaza_2000_martin_Matutino_Plaza_2000_BAJA_Puntoeste_5d3b2459_7ef8_4bf0_8ee9_9434e02e1a28_20260504215054.mp4",
  "https://cfsp-s3-bucket-prod.s3.us-east-2.amazonaws.com/Sin_Cliente/incidencias/Sin_Cliente_admin_Sin_Turno_incident_20260506033713.mp4",
];

export const E2E_MEDIA_MIXED = [
  ...E2E_MEDIA_PHOTOS.slice(0, 5),
  ...E2E_MEDIA_VIDEOS,
];

export const getRandomEvidence = (photoCount: number = 3): string[] => {
  const shuffledPhotos = [...E2E_MEDIA_PHOTOS].sort(() => 0.5 - Math.random());
  const selectedPhotos = shuffledPhotos.slice(0, photoCount);

  const shuffledVideos = [...E2E_MEDIA_VIDEOS].sort(() => 0.5 - Math.random());
  const selectedVideo = shuffledVideos[0];

  const combined = [...selectedPhotos, selectedVideo];
  return combined.sort(() => 0.5 - Math.random());
};
