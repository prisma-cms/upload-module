
import ImagesMiddleware from "./middleware/ImageThumb";

import PrismaUploadModule from "./modules";


import GalleryModule, {
  GalleryProcessor,
} from "./modules/Gallery";

export {
  GalleryModule,
  GalleryProcessor,
};


export const Modules = [
  GalleryModule,
];


export {
  ImagesMiddleware,
  PrismaUploadModule,
}

export default PrismaUploadModule
