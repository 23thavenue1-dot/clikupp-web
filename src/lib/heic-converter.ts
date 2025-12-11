import dynamic from 'next/dynamic';

const heic2any = dynamic(() => import('heic2any'), {
  ssr: false, // Cette librairie ne doit s'exécuter que côté client
});

export default heic2any;
