# Cypress tests
There are some custom cypress commands available making it easier to write tests,
for example you can get the editor content and insert text by using

```js
cy.getContent()
    .type('some test')
```

### Available custom commands
| Command              | Function               | Parameters                          |
| -------------------- | ---------------------- | ----------------------------------- |
| `nextcloudUpdateUser`| Update user setting    | `user`, `password`, `key`, `value`  |
| `nextcloudDeleteUser`| Delete user            | `user`                              |
| `uploadFile`         | Upload file            | `fileName`, `mimeType`, `target`    |
| `createFile`         | Create file            | `target`, `content`, `mimeType`     |
| `moveFile`           | Move a file            | `path`, `destinationPath`           |
| `copyFile`           | Copy file              | `path`, `destinationPath`           |
| `createFolder`       | Create a folder        | `dirName`                           |
| `shareFileToUser`    | Share a file with user | `userId`, `password`, `path`, `targetUserId`|
| `openFile`           | Open file in Viewer / Editor | `fileName`, `clickParams`     |
| `closeFile`          | Close the current file |                                     |
| `getFile`            | Get file list element of file | `fileName`                   |
| `deleteFile`         | Remove a file          | `fileName`                          |
| `reloadFileList`     | Refresh the file list  |                                     |
| `getEditor`          | Get TipTap Editor element |                                  |
| `getContent`         | Get editor content     |                                     |
| `clearContent`       | Clear the editor content |                                   |
| `getMenu`            | Get editor menu bar    |                                     |
| `getMenuEntry`       | Same as `getActionEntry` but also searches the overflow menu | `name` |
| `getSubmenuEntry`    | Open parent menu and then return sub menu entry | `parent`, `name` |
| `getActionEntry`     | Get menu entry         | `name`                              |
| `getActionSubEntry`  | Get submenu entry (after menu clicked) | `name`              |
| `openWorkspace`      | Open workspace and return Editor content |                   |

### Commands from `@nextcloud/cypress`

We also use some commands from `@nextcloud/cypress`:
* `login(user)`
* `logout()`
* `createRandomUser().then(user => login(user))`
* `createUser(user)`

see https://github.com/nextcloud/nextcloud-cypress
