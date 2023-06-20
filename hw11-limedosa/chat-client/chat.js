import * as Vue from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from "https://graffiti.garden/graffiti-js/plugins/vue/plugin.js";
import Resolver from "./resolver.js";
import axios from "https://cdn.skypack.dev/axios@0.24.0";

const app = {
  // Import MaVue
  mixins: [mixin],

  // Import resolver
  created() {
    this.resolver = new Resolver(this.$gf);
    this.populateUsernames();
  },

  setup() {
    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref("default");

    // And a flag for whether or not we're private-messaging
    const pick = Vue.ref("nav-updates");

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject("graffiti");
    const context = Vue.computed(() => {
      if (pick.value == "nav-private") {
        return [$gf.me];
      } else {
        return [channel.value];
      }
    });

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context);
    return { channel, pick, messagesRaw };
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: "",
      usernames: [],
      editID: "",
      editText: "",
      recipient: "",
      //////////////////////////////
      // Problem 1 solution
      preferredUsername: "",
      usernameResult: "",
      //////////////////////////////
      //////////////////////////////
      // Problem 2 solution
      recipientUsername: "",
      recipientUsernameSearch: "",
      //////////////////////////////
      //////////////////////////////
      // Problem 3 solution
      myUsername: "",
      actorsToUsernames: {},
      /////////////////////////////
      imageDownloads: {},
      person: {},
      searchQuery: "",
      pick: "nav-updates",
      replies: {},
    };
  },

  //////////////////////////////
  // Problem 3 solution
  watch: {
    "$gf.me": async function (me) {
      this.myUsername = await this.resolver.actorToUsername(me);
    },

    async messages(messages) {
      for (const m of messages) {
        if (!(m.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[m.actor] = await this.resolver.actorToUsername(
            m.actor
          );
        }
        if (m.bto && m.bto.length && !(m.bto[0] in this.actorsToUsernames)) {
          this.actorsToUsernames[m.bto[0]] =
            await this.resolver.actorToUsername(m.bto[0]);
        }
      }
    },

    async messagesWithAttachments(messages) {
      for (const m of messages) {
        if (!(m.attachment.magnet in this.imageDownloads)) {
          this.imageDownloads[m.attachment.magnet] = "downloading";
          let blob;
          try {
            blob = await this.$gf.media.fetch(m.attachment.magnet);
          } catch (e) {
            this.imageDownloads[m.attachment.magnet] = "error";
            continue;
          }
          this.imageDownloads[m.attachment.magnet] = URL.createObjectURL(blob);
        }
      }
    },
  },
  /////////

  computed: {
    messages() {
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(
          (m) =>
            // Does the message have a type property?
            m.type &&
            // Is the value of that property 'Note'?
            m.type == "Note" &&
            // Does the message have a content property?
            m.content &&
            // Is that property a string?
            typeof m.content == "string"
        );

      // Do some more filtering for private messaging
      if (this.pick === "nav-private") {
        messages = messages.filter(
          (m) =>
            // Is the message private?
            m.bto &&
            // Is the message to exactly one person?
            m.bto.length == 1 &&
            // Is the message to the recipient?
            (m.bto[0] == this.recipient ||
              // Or is the message from the recipient?
              m.actor == this.recipient)
        );
      }
      if (this.searchQuery) {
        messages = messages.filter((m) =>
          m.content.toLowerCase().includes(this.searchQuery.toLowerCase())
        );
      }
      if (this.findPeople) {
        messages = messages.filter((m) =>
          m.content.toLowerCase().includes(this.findPeople.toLowerCase())
        );
      }

      return (
        messages
          // Sort the messages with the
          // most recently created ones first
          .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
          // Only show the 10 most recent ones
          .slice(0, 50)
      );
    },
    messagesWithAttachments() {
      return this.messages.filter(
        (m) =>
          m.attachment &&
          m.attachment.type == "Image" &&
          typeof m.attachment.magnet == "string"
      );
    },
  },

  methods: {
    // async populateUsernames() {
    //   const result = await axios.get("/api/usernames");
    //   this.usernames = result.data;
    // },
    // async populateUsernames() {
    //   const result = await axios.get("/api/usernames");
    //   this.usernames = result.data;
    // },    
    async populateUsernames() {
      try {
        const response = await axios.get('/api/usernames');
        this.usernames = response.data;
      } catch (error) {
        console.error('Failed to fetch usernames:', error);
      }
    },    
    async populateRecipients() {
      const result = await axios.get("/api/usernames");
      this.recipients = result.data;
    },

    async sendMessage() {
      const message = {
        type: "Note",
        content: this.messageText,
      };

      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private
      if (this.file) {
        message.attachment = {
          type: "Image",
          magnet: await this.$gf.media.store(this.file),
        };
        this.file = null;
      }
      if (this.pick === "nav-private") {
        message.bto = [this.recipient];
        message.context = [this.$gf.me, this.recipient];
      } else {
        message.context = [this.channel];
      }

      // Send!
      this.$gf.post(message);
    },

    removeMessage(message) {
      this.$gf.remove(message);
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id;
      // And copy over it's existing text
      this.editText = message.content;
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText;
      // And clear the edit mark
      this.editID = "";
    },

    /////////////////////////////
    // Problem 1 solution
    async setUsername() {
      try {
        const result = await axios.post("/api/set-username", {
          username: this.preferredUsername,
        });
        this.usernameResult = result.data;
        this.myUsername = this.preferredUsername;
      } catch (e) {
        this.usernameResult = e.toString();
      }
    },
    /////////////////////////////

    /////////////////////////////
    // Problem 2 solution
    async chatWithUser() {
      try {
        const result = await axios.post("/api/username-to-actor", {
          username: this.recipientUsernameSearch,
        });
        this.recipient = result.data;
        this.recipientUsername = this.recipientUsernameSearch;
      } catch (e) {
        console.error(e);
      }
    },

    /////////////////////////////
    onImageAttachment(event) {
      const file = event.target.files[0];
      this.file = file;
    },
  },
};

const Name = {
  props: ["actor", "editable"],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props);
    const $gf = Vue.inject("graffiti");
    return $gf.useObjects([actor]);
  },

  computed: {
    profile() {
      return (
        this.objects
          // Filter the raw objects for profile data
          // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-profile
          .filter(
            (m) =>
              // Does the message have a type property?
              m.type &&
              // Is the value of that property 'Profile'?
              m.type == "Profile" &&
              // Does the message have a name property?
              m.name &&
              // Is that property a string?
              typeof m.name == "string"
          )
          // Choose the most recent one or null if none exists
          .reduce(
            (prev, curr) =>
              !prev || curr.published > prev.published ? curr : prev,
            null
          )
      );
    },
  },

  data() {
    return {
      editing: false,
      editText: "",
    };
  },

  methods: {
    editName() {
      this.editing = true;
      // If we already have a profile,
      // initialize the edit text to our existing name
      this.editText = this.profile ? this.profile.name : this.editText;
    },

    saveName() {
      if (this.profile) {
        // If we already have a profile, just change the name
        // (this will sync automatically)
        this.profile.name = this.editText;
      } else {
        // Otherwise create a profile
        this.$gf.post({
          type: "Profile",
          name: this.editText,
        });
      }

      // Exit the editing state
      this.editing = false;
    },
  },

  template: "#name",
};
////////////////////profile/
const ProfilePicture = {
  props: ["actor", "editable"],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props);
    const $gf = Vue.inject("graffiti");

    // Reactive variable to store the image file
    const file = Vue.ref(null);

    // Reactive variable to store the image URL
    const imageUrl = Vue.ref(null);

    // Load the profile picture if it exists
    const profile = Vue.computed(() => {
      const objects = $gf.useObjects([actor]).value;
      const profileObject = objects.find(
        (obj) =>
          obj.type === "Profile" && obj.image && typeof obj.image === "string"
      );
      if (profileObject) {
        imageUrl.value = profileObject.image;
      }
      return profileObject;
    });

    // Handle file upload and update the image URL
    const handleFileUpload = (event) => {
      file.value = event.target.files[0];
      imageUrl.value = URL.createObjectURL(file.value);
    };

    // Save the profile picture
    const saveProfilePicture = async () => {
      if (!file.value) {
        return;
      }
      const formData = new FormData();
      formData.append("file", file.value);
      const response = await $gf.postImage(formData);
      const newImageObject = {
        type: "Image",
        name: file.value.name,
        url: response.url,
      };
      const profileObject = profile.value || { type: "Profile" };
      profileObject.image = newImageObject;
      await $gf.post(profileObject);
      file.value = null;
      imageUrl.value = response.url;
      editing.value = false;
    };

    // Reactive variable to store the editing state
    const editing = Vue.ref(false);

    // Enter the editing state and reset the image file
    const editProfilePicture = () => {
      editing.value = true;
      file.value = null;
    };

    return {
      file,
      imageUrl,
      profile,
      editing,
      handleFileUpload,
      saveProfilePicture,
      editProfilePicture,
    };
  },

  template: "#pfp",
};

const Like = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject("graffiti");
    const messageid = Vue.toRef(props, "messageid");
    const { objects: likesRaw } = $gf.useObjects([messageid]);
    return { likesRaw };
  },

  computed: {
    likes() {
      return this.likesRaw.filter(
        (l) => l.type == "Like" && l.object == this.messageid
      );
    },

    numLikes() {
      // Unique number of actors
      return [...new Set(this.likes.map((l) => l.actor))].length;
    },

    myLikes() {
      return this.likes.filter((l) => l.actor == this.$gf.me);
    },
  },

  methods: {
    toggleLike() {
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes);
      } else {
        this.$gf.post({
          type: "Like",
          object: this.messageid,
          context: [this.messageid],
        });
      }
    },
  },

  template: "#like",
};
const Read = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject("graffiti");
    const messageid = Vue.toRef(props, "messageid");
    const { objects: readsRaw } = $gf.useObjects([messageid]);
    return { readsRaw };
  },

  computed: {
    reads() {
      return this.readsRaw.filter(
        (l) => l.type == "Read" && l.object == this.messageid
      );
    },

    numReads() {
      // Unique number of actors
      return [...new Set(this.reads.map((l) => l.actor))].length;
    },

    myReads() {
      return this.reads.filter((l) => l.actor == this.$gf.me);
    },
  },

  methods: {
    toggleRead() {
      if (this.myReads.length) {
        this.$gf.remove(...this.myReads);
      } else {
        this.$gf.post({
          type: "Read",
          object: this.messageid,
          context: [this.messageid],
        });
      }
    },
  },

  template: "#read",
};

const Replies = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject("graffiti");
    const messageid = Vue.toRef(props, "messageid");
    return $gf.useObjects([messageid]);
  },

  computed: {
    replies() {
      return this.objects
        .filter(
          (o) =>
            o.type == "Note" &&
            typeof o.content == "string" &&
            o.inReplyTo == this.messageid
        )
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published));
    },
  },

  data() {
    return {
      content: "",
    };
  },

  methods: {
    postReply() {
      if (!this.content) return;

      this.$gf.post({
        type: "Note",
        content: this.content,
        inReplyTo: this.messageid,
        context: [this.messageid],
      });
      this.content = "";
    },
  },

  template: "#replies",
};

const ReadReceipts = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject("graffiti");
    const messageid = Vue.toRef(props, "messageid");
    return $gf.useObjects([messageid]);
  },

  async mounted() {
    if (!this.readActors.includes(this.$gf.me)) {
      this.$gf.post({
        type: "Read",
        object: this.messageid,
        context: [this.messageid],
      });
    }
  },

  computed: {
    reads() {
      return this.objects.filter(
        (o) => o.type == "Read" && o.object == this.messageid
      );
    },

    myReads() {
      return this.reads.filter((r) => r.actor == this.$gf.me);
    },

    readActors() {
      return [...new Set(this.reads.map((r) => r.actor))];
    },
  },

  watch: {
    // In case we accidentally "read" more than once.
    myReads(myReads) {
      if (myReads.length > 1) {
        // Remove all but one
        this.$gf.remove(...myReads.slice(1));
      }
    },
  },

  template: "#read-receipts",
};

app.components = { Name, Like, ProfilePicture, Read };
Vue.createApp(app).use(GraffitiPlugin(Vue)).mount("#app");
Vue.createApp(app)
  .component("name", Name)
  .component("like", Like)
  .component("magnet-img", MagnetImg)
  .component("profile-picture", ProfilePicture)
  .component("replies", Replies)
  .component("read-receipts", ReadReceipts)
  .use(GraffitiPlugin(Vue))
  .mount("#app");
