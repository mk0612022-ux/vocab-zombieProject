// ===================================================================
// The player's account (new series: the screens in round 2, the accounts
// themselves in round 4)
// -------------------------------------------------------------------
// Until round 4 there are no accounts: everyone plays as a Guest and the
// progress stays on this device (Export / Import Save moves it). The Start
// screen's bar and Settings > Account read the state from here, so round 4
// only has to fill this in:
//   G.Account.state()   { signedIn, name, uid, provider, created, sync }
//   G.Account.signIn(done)    signOut(done)    deleteAccount(done)
// ===================================================================
window.G = window.G || {};

(function () {
  const T = (k, v) => G.T(k, v);

  G.Account = {
    state() {
      return { signedIn: false, name: "", uid: null, provider: null, created: null, sync: "local" };
    },
    // (round 4: Google, Facebook, Apple ID)
    signIn(done) {
      G.Dialog.open({
        icon: "👤", title: T("account.signInTitle"), text: T("account.soon"),
        buttons: [{ label: T("dialog.ok"), primary: true, cancel: true, action: () => { if (done) done(); } }],
      });
    },
    signOut(done) { if (done) done(); },
    deleteAccount(done) { if (done) done(); },
  };
})();
