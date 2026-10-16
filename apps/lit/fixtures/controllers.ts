import { LitElement, html } from 'lit';
import { KBarStore, KBarController, KBarActionsController } from 'kbar-lit';
import 'kbar-lit/register';

const first = new KBarStore([{ id: 'first', name: 'First' }]);
const second = new KBarStore([{ id: 'second', name: 'Second' }]);
class Consumer extends LitElement {
  kbar = new KBarController(this);
  render() {
    return html`<output>${this.kbar.state?.search ?? ''}</output>`;
  }
}
class Registrant extends LitElement {
  actions = new KBarActionsController(this, first, [{ id: 'registered', name: 'Registered' }]);
}
customElements.define('test-consumer', Consumer);
customElements.define('test-registrant', Registrant);
const provider = document.createElement('kbar-provider');
provider.store = first;
const consumer = new Consumer();
const registrant = new Registrant();
provider.append(consumer, registrant);
document.body.append(provider);
Object.assign(window, { controllerFixture: { first, second, provider, consumer, registrant } });
