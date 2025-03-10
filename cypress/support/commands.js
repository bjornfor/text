/**
 * @copyright Copyright (c) 2019 John Molakvoæ <skjnldsv@protonmail.com>
 *
 * @author John Molakvoæ <skjnldsv@protonmail.com>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import axios from '@nextcloud/axios'
import { addCommands } from '@nextcloud/cypress'

// eslint-disable-next-line no-unused-vars,n/no-extraneous-import
import regeneratorRuntime from 'regenerator-runtime'

const url = Cypress.config('baseUrl').replace(/\/index.php\/?$/g, '')
Cypress.env('baseUrl', url)

addCommands()

// Keep track of the current user authentication.
// We need it for various commands to authenticate
// and also to determine paths, urls and the like.
let auth
Cypress.Commands.overwrite('login', (login, user) => {
	auth = { user: user.userId, password: user.password }
	login(user)
})

Cypress.Commands.add('ocsRequest', (options) => {
	return cy.request({
		form: true,
		auth,
		headers: {
			'OCS-ApiRequest': 'true',
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		...options,
	})
})

Cypress.Commands.add('updateUserSetting', (key, value) => {
	cy.ocsRequest({
		method: 'PUT',
		url: `${url}/ocs/v2.php/cloud/users/${auth.user}`,
		body: { key, value },
	}).then(response => {
		cy.log(`Updated ${auth.user} ${key} to ${value}`, response.status)
	})
})

Cypress.Commands.add('nextcloudDeleteUser', (user) => {
	cy.clearCookies()
	cy.ocsRequest({
		method: 'DELETE',
		url: `${url}/ocs/v1.php/cloud/users/${user}`,
		auth: { user: 'admin', pass: 'admin' },
	}).then(response => {
		cy.log(`Deleted user ${user}`, response.status)
	})
})

Cypress.Commands.add('uploadFile', (fileName, mimeType, target) => {
	return cy.fixture(fileName, 'base64')
		.then(Cypress.Blob.base64StringToBlob)
		.then(blob => {
			const file = new File([blob], fileName, { type: mimeType })
			if (typeof target !== 'undefined') {
				fileName = target
			}
			return cy.request('/csrftoken')
				.then(({ body }) => body.token)
				.then(requesttoken => {
					return axios.put(`${url}/remote.php/webdav/${fileName}`, file, {
						headers: {
							requesttoken,
							'Content-Type': mimeType,
						},
					}).then(response => {
						cy.log(`Uploaded ${fileName}`, response.status)
					})
				})
		})
})

Cypress.Commands.add('createFile', (target, content, mimeType = 'text/markdown') => {
	const fileName = target.split('/').pop()

	const blob = new Blob([content], { type: mimeType })
	const file = new File([blob], fileName, { type: mimeType })

	return cy.window()
		.then(async win => {
			const response = await axios.put(`${url}/remote.php/webdav/${target}`, file, {
				headers: {
					requesttoken: win.OC.requestToken,
					'Content-Type': mimeType,
				},
			})

			return cy.log(`Uploaded ${fileName}`, response.status)
		})

})

Cypress.Commands.add('shareFileToUser', (path, targetUser) => {
	cy.clearCookies()
	cy.ocsRequest({
		method: 'POST',
		url: `${url}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
		body: {
			path,
			shareType: 0,
			shareWith: targetUser.userId,
		},
	}).then(response => {
		cy.log(`${auth.user} shared ${path} with ${targetUser.userId}`, response.status)
	})
})

Cypress.Commands.add('isolateTest', ({ sourceFile = 'empty.md', targetFile = null, onBeforeLoad } = {}) => {
	targetFile = targetFile || sourceFile

	const retry = cy.state('test').currentRetry()
	const folderName = retry
		? `${Cypress.currentTest.title} (${retry})`
		: Cypress.currentTest.title

	cy.createFolder(folderName)
	cy.uploadFile(sourceFile, 'text/markdown', `${encodeURIComponent(folderName)}/${targetFile}`)

	window.__currentDirectory = folderName
	return cy.visit(`apps/files?dir=/${encodeURIComponent(folderName)}`, { onBeforeLoad })
		.then(() => ({ folderName, fileName: targetFile }))
})

Cypress.Commands.add('shareFile', (path, options = {}) => {
	return cy.window().then(async window => {
		try {
			const headers = { requesttoken: window.OC.requestToken }
			const request = await axios.post(
				`${url}/ocs/v2.php/apps/files_sharing/api/v1/shares`,
				{ path, shareType: window.OC.Share.SHARE_TYPE_LINK },
				{ headers }
			)
			const token = request.data?.ocs?.data?.token
			const id = request.data?.ocs?.data?.id
			if (!token || !id || token.length === 0) {
				throw request
			}
			cy.log(`Share link created: ${token}`)

			if (options.edit) {
				// Same permissions makeing the share editable in the UI would set
				// 1 = read; 2 = write; 16 = share;
				const permissions = 19
				await axios.put(
					`${url}/ocs/v2.php/apps/files_sharing/api/v1/shares/${id}`,
					{ permissions },
					{ headers }
				)
				cy.log(`Made share ${token} editable.`)
			}
			return cy.wrap(token)
		} catch (error) {
			console.error(error)
		}
	}).should('have.length', 15)
})

Cypress.Commands.add('createFolder', dirName => cy.window()
	.then(win => win.OC.Files.getClient().createDirectory(dirName))
)

Cypress.Commands.add('moveFile', (path, destinationPath) => cy.window()
	.then(win => win.OC.Files.getClient().move(path, destinationPath))
)

Cypress.Commands.add('removeFile', (path) => cy.window()
	.then(win => win.OC.Files.getClient().remove(path))
)

Cypress.Commands.add('copyFile', (path, destinationPath) => cy.window()
	.then(win => win.OC.Files.getClient().copy(path, destinationPath))
)

Cypress.Commands.add('getFileContent', (path) => {
	return cy.request({
		method: 'GET',
		url: `${url}/remote.php/webdav/${path}`,
		auth,
	}).then(response => {
		cy.wrap(response.body)
	})
})

Cypress.Commands.add('propfindFolder', (path, depth = 0) => {
	return cy.window()
		.then(win => {
			const files = win.OC.Files
			const PROPERTY_WORKSPACE_FILE
				= `{${files.Client.NS_NEXTCLOUD}}rich-workspace-file`
			const PROPERTY_WORKSPACE
				= `{${files.Client.NS_NEXTCLOUD}}rich-workspace`
			const properties = [
				...files.getClient().getPropfindProperties(),
				PROPERTY_WORKSPACE_FILE,
				PROPERTY_WORKSPACE,
			]
			const client = files.getClient().getClient()
			return client.propFind(client.baseUrl + path, properties, depth)
				.then((results) => {
					cy.log(`Propfind returned ${results.status}`)
					if (depth) {
						return results.body
					} else {
						return results.body.propStat[0].properties
					}
				})
		})
})

Cypress.Commands.add('reloadFileList', () => cy.window()
	.then(win => win.OCA?.Files?.App?.fileList?.reload())
)

Cypress.Commands.add('openFolder', (name) => {
	const url = `**/${encodeURI(name)}`
	cy.intercept({ method: 'PROPFIND', url })
		.as(`open-${name}`)
	cy.openFile(name)
	cy.wait(`@open-${name}`)
})

Cypress.Commands.add('openFile', (fileName, params = {}) => {
	cy.get(`.files-fileList tr[data-file="${fileName}"] a.name`).click(params)
})

Cypress.Commands.add('closeFile', (fileName, params = {}) => {
	cy.get('#viewer .modal-header button.header-close').click(params)
	cy.get('#viewer .modal-header').should('not.exist')
})

Cypress.Commands.add('getFile', fileName => {
	return cy.get(`.files-fileList tr[data-file="${fileName}"]`)
})

Cypress.Commands.add('deleteFile', fileName => {
	cy.get(`.files-fileList tr[data-file="${fileName}"] a.name .action-menu`).click()
	cy.get(`.files-fileList tr[data-file="${fileName}"] a.name + .popovermenu .action-delete`).click()
	cy.get(`.files-fileList tr[data-file="${fileName}"]`).should('not.exist')
})

Cypress.Commands.add('getModal', () => {
	return cy.get('#viewer[data-handler="text"]')
})

Cypress.Commands.add('getEditor', { prevSubject: 'optional' }, (subject) => {
	return subject
		? cy.wrap(subject).find('[data-text-el="editor-container"]')
		: cy.get('[data-text-el="editor-container"]')
})

Cypress.Commands.add('getMenu', { prevSubject: 'optional' }, (subject) => {
	return (subject ? cy.wrap(subject) : cy.getEditor())
		.find('[data-text-el="menubar"]')
})

// Get menu entry even if moved into overflow menu
Cypress.Commands.add('getMenuEntry', (name) => {
	cy.getMenu().then(($body) => {
		if ($body.find(`[data-text-action-entry="${name}"]`).length) {
			return cy.getActionEntry(name)
		}
		return cy.getSubmenuEntry('remain', name)
	})
})

Cypress.Commands.add('getSubmenuEntry', { prevSubject: 'optional' }, (subject, parent, name) => {
	return (subject ? cy.wrap(subject) : cy.getMenu())
		.getActionEntry(parent)
		.click()
		.then(() => cy.getActionSubEntry(name))
})

Cypress.Commands.add('getActionEntry', { prevSubject: 'optional' }, (subject, name) => {
	return (subject ? cy.wrap(subject) : cy.getMenu())
		.find(`[data-text-action-entry="${name}"]`)
})

Cypress.Commands.add('getActionSubEntry', (name) => {
	return cy.get('.action-item__popper .open').getActionEntry(name)
})

Cypress.Commands.add('getContent', { prevSubject: 'optional' }, (subject) => {
	return (subject ? cy.wrap(subject) : cy.getEditor())
		.find('.ProseMirror')
})

Cypress.Commands.add('getOutline', () => {
	return cy.getEditor().find('[data-text-el="editor-outline"]')
})

Cypress.Commands.add('getTOC', () => {
	return cy.getEditor().find('[data-text-el="editor-table-of-contents"]')
})

Cypress.Commands.add('clearContent', () => {
	return cy.getContent()
		.scrollIntoView()
		.then(() => cy.getContent()
			.type('{selectAll}{backspace}')
		)
		.then(() => cy.getContent())
})

Cypress.Commands.add('openWorkspace', () => {
	cy.get('#rich-workspace .empty-workspace').click()
	cy.getEditor().find('[data-text-el="editor-content-wrapper"]').click()

	return cy.getContent()
})

Cypress.Commands.add('configureText', (key, value) => {
	return cy.window().then(win => {
		return axios.post(
			`${url}/index.php/apps/text/settings`,
			{ key, value },
			{ headers: { requesttoken: win.OC.requestToken } }
		)
	})
})

Cypress.Commands.add('showHiddenFiles', () => {
	cy.get('#app-settings-header')
		.click()
	cy.intercept({ method: 'POST', url: '**/showhidden' }).as('showHidden')
	cy.get('#app-settings-content label[for=showhiddenfilesToggle]')
		.click()
	cy.wait('@showHidden')
})
