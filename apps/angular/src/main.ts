import { bootstrapApplication } from '@angular/platform-browser';
import 'kbar-lit/register';
import { AppComponent } from './app.component';
bootstrapApplication(AppComponent).catch((error) => console.error(error));
