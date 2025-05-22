import { Component, OnInit } from '@angular/core';
import { DotLottie } from '@lottiefiles/dotlottie-web';

@Component({
  selector: 'app-default-loader',
  templateUrl: './default-loader.component.html',
  styleUrls: ['./default-loader.component.scss']
})
export class DefaultLoaderComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
    const dotLottie = new DotLottie({
      autoplay: true,
      loop: true,
      // @ts-ignore
      canvas: document.querySelector('#dotlottie-canvas'),
      src: "/assets/loader.lottie", // replace with your .lottie or .json file URL
  });
  }
}
