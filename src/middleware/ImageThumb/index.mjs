
import sharp from "sharp";
import fs from "fs";
import mime from 'mime-types';

class ImagesMiddleware {


  constructor() {

    this.processRequest = this.processRequest.bind(this);

  }


  async processRequest(req, res, next) {

    const {
      0: src,
      type,
    } = req.params;

    let path = `/uploads/${src}`;

    const abthPath = process.cwd() + path;


    if (fs.existsSync(abthPath)) {

      const mimetype = mime.lookup(abthPath);


      const contentType = mimetype;

      // console.log("contentType", contentType);


      let data;


      switch (contentType) {

        case "image/svg+xml":

          break;

        default: {

          let img = await sharp(abthPath);

          const metadata = await img.metadata()
          // .then(function (result) {

          //   metadata = result;

          // });

          data = await this.resizeImg(img, type, metadata)
            .then(async () => {

              // const contentType = this.getContentType(metadata);


              if (!contentType) {
                res.status(500);
                res.send("Can not get contentType");
                return;
              }

              return await img
                .withMetadata()
                .toBuffer()
                // .then(data => {

                //   res.status(200);
                //   res.contentType(contentType);
                //   res.send(data);

                // })
                .catch(e => {
                  console.error(e);

                  res.status(500);
                  res.send(e.message);

                });

            })
            .catch(error => {

              res.status(500);
              res.send(error.message);
            });


          if (!data) {
            return;
          }

        }

      }





      if (data) {

        res.status(200);
        res.contentType(contentType);
        res.send(data);
      }
      else {

        res.sendFile(abthPath);
      }


    }
    else {

      res.status(404).send('File not found');

    }


  }


  async resizeImg(img, type, metadata) {

    switch (type) {

      case 'origin':

        break;

      case 'avatar':

        img
          .resize(200, 200);

        break;



      case 'thumb':

        // DeprecationWarning: crop(position) is deprecated, use resize({ fit: "cover", position }) instead

        img
          // .resize(150, 150)
          // .crop(sharp.gravity.north);
          .resize({
            width: 150,
            height: 150,
            // fit: "fill",
            fit: "cover",
            position: sharp.gravity.north,
          });

        break;


      case 'small':

        img
          // .resize(200, 160)
          // // .resize({ fit: "inside" })
          // .resize({ fit: "cover" })
          // ;
          .resize({
            width: 200,
            height: 160,
            fit: "inside",
            // position: sharp.gravity.north,
          })

        break;


      case 'middle':

        img
          // .resize(700, 430)
          // .resize({ fit: "inside" })
          // .resize({ fit: "cover" });
          .resize({
            width: 700,
            height: 430,
            fit: "inside",
            // position: sharp.gravity.north,
          })

        break;


      case 'big':

        img
          .resize({ fit: "inside" });
        this.resizeMax(img, 1200, 1000, metadata);

        break;

      default:

        throw new Error("Wrong image type");
        return;
    }

    return img;
  }


  resizeMax(img, width, height, metadata) {

    const {
      width: originWidth,
      height: originHeight,
    } = metadata;

    if (width < originWidth || height < originHeight) {

      img
        .resize({ fit: "inside" })
        .resize(width, height)
        .resize({ fit: "inside" })
        ;
    }
  }


  getContentType(metadata) {

    console.error("getContentType() deprecated");

    let contentType;

    const {
      format,
    } = metadata;

    if (format) {
      // throw new Error("Can not get format");
      contentType = `image/${format}`
    }

    return contentType;
  }

}


export default ImagesMiddleware;