import axios, { AxiosRequestConfig } from 'axios'
import chalk from 'chalk'
import * as Either from 'fp-ts/lib/Either'
import ora from 'ora'
import { CollectionDefinition } from 'postman-collection'

export type PostmanApiWorkspaceResult = {
  id: string
  name: string
  type: string
}

export type PostmanApiWorkspaceDetailResult = {
  id: string
  name: string
  type: string
  description: string
  createdAt: string
  updatedAt: string
  collections: [
    {
      id: string
      uid: string
      name: string
    }
  ]
}

export type PostmanApiCollectionResult = {
  id: string
  uid: string
  name: string
  owner: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export class PostmanApiService {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = 'https://api.getpostman.com'
    this.apiKey = `${process.env.POSTMAN_API_KEY}`
  }

  async getWorkspaces(): Promise<Either.Either<string, PostmanApiWorkspaceResult[]>> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data

      if (Array.isArray(data?.workspaces)) {
        return Either.right(data.workspaces)
      } else {
        return Either.left('No workspaces found')
      }
    } catch (error) {
      return Either.left(error.toString())
    }
  }

  async getWorkspace(id: string): Promise<Either.Either<string, PostmanApiWorkspaceDetailResult>> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/workspaces/${id}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data

      if (data?.workspace) {
        return Either.right(data.workspace)
      } else {
        return Either.left('Workspace not found')
      }
    } catch (error) {
      return Either.left(error.toString())
    }
  }

  async getCollections(): Promise<Either.Either<string, PostmanApiCollectionResult[]>> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/collections`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data

      if (Array.isArray(data?.collections)) {
        return Either.right(data.collections)
      } else {
        return Either.left('No collections found')
      }
    } catch (error) {
      return Either.left(error.toString())
    }
  }

  async createCollection(collection: CollectionDefinition, workspaceId?: string): Promise<string> {
    const data = JSON.stringify({
      collection: collection
    })
    const workspaceIdParam = workspaceId ? `?workspace=${workspaceId}` : ''
    const config = {
      method: 'post',
      url: `${this.baseUrl}/collections${workspaceIdParam}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      data: data
    } as AxiosRequestConfig

    const spinner = ora({
      prefixText: ' ',
      text: 'Uploading & creating collection in Postman ...\n'
    })

    // Start Spinner
    spinner.start()

    try {
      axios.interceptors.request.use(req => {
        return req
      })

      const res = await axios(config)
      const respData = res.data

      spinner.succeed('Upload to Postman Success')
      return JSON.stringify({ status: 'success', data: respData }, null, 2)
    } catch (error) {
      spinner.fail(chalk.red(`Upload to Postman Failed`))
      spinner.clear()
      return JSON.stringify({ status: 'fail', data: error?.response?.data }, null, 2)
    }
  }

  async updateCollection(
    collection: CollectionDefinition,
    postmanUid: string,
    workspaceId?: string
  ): Promise<string> {
    const data = JSON.stringify({
      collection: collection
    })
    const workspaceIdParam = workspaceId ? `?workspace=${workspaceId}` : ''
    const config = {
      method: 'put',
      url: `${this.baseUrl}/collections/${postmanUid}${workspaceIdParam}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      data: data
    } as AxiosRequestConfig

    const spinner = ora({
      prefixText: ' ',
      text: 'Updating collection in Postman ...\n'
    })

    // Start Spinner
    spinner.start()
    let responseStatusCode

    try {
      axios.interceptors.request.use(req => {
        return req
      })

      axios.interceptors.response.use(
        response => {
          responseStatusCode = response.status
          return response
        },
        error => {
          // Some errors don't have a response
          if (!error.response) {
            error.response = {}
          }
          responseStatusCode = error?.response?.status || error?.code
          return error
        }
      )

      const res = await axios(config)
      const respData = res.data

      spinner.succeed('Upload to Postman Success')
      return JSON.stringify({ status: 'success', data: respData }, null, 2)
    } catch (error) {
      spinner.fail(chalk.red(`Upload to Postman Failed: ${responseStatusCode}`))
      spinner.clear()
      return JSON.stringify(
        {
          status: 'fail',
          data: error?.response?.data || error.response || error?.toJSON() || error?.toString()
        },
        null,
        2
      )
    }
  }

  async findCollectionByName(collName: string): Promise<CollectionDefinition> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/collections`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data
      let match = {}

      if (data.collections) {
        // Match all items by name, since Postman API does not support filtering by name
        const matches = data.collections.filter((o: CollectionDefinition) => {
          if (!o?.name) return
          return (
            o.name.toLowerCase().replace(/\s/g, '') === collName.toLowerCase().replace(/\s/g, '')
          )
        })

        if (matches.length === 1) {
          match = matches[0]
        }
        if (matches.length > 1) {
          // Sort by date and take newest
          matches.sort((a, b) => {
            // Turn your strings into dates, and then subtract them
            // to get a value that is either negative, positive, or zero.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <any>new Date(b.updatedAt) - <any>new Date(a.updatedAt)
          })
          console.log(
            `\nMultiple Postman collection matching "${collName}", the most recent collection is updated.`
          )
          match = matches[0]
        }
      }
      return match
    } catch (error) {
      console.log(error?.response?.data)
      return error.toString()
    }
  }

  async findWorkspaceCollectionByName(
    workspaceId: string,
    collName: string
  ): Promise<CollectionDefinition> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/workspaces/${workspaceId}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data
      let match = {}

      if (data?.workspace.collections) {
        // Match all items by name, since Postman API does not support filtering by name
        const matches = data.workspace.collections.filter((o: CollectionDefinition) => {
          if (!o?.name) return
          return (
            o.name.toLowerCase().replace(/\s/g, '') === collName.toLowerCase().replace(/\s/g, '')
          )
        })

        if (matches.length === 1) {
          match = matches[0]
        }
        if (matches.length > 1) {
          // Sort by date and take newest
          matches.sort((a, b) => {
            // Turn your strings into dates, and then subtract them
            // to get a value that is either negative, positive, or zero.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <any>new Date(b.updatedAt) - <any>new Date(a.updatedAt)
          })
          console.log(
            `\nMultiple Postman collection matching "${collName}" in the workspace, the most recent collection is updated.`
          )
          match = matches[0]
        }
      }
      return match
    } catch (error) {
      console.log(error?.response?.data)
      return error.toString()
    }
  }

  async findWorkspaceByName(workspaceName: string): Promise<CollectionDefinition> {
    const config = {
      method: 'get',
      url: `${this.baseUrl}/workspaces`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    } as AxiosRequestConfig

    try {
      const res = await axios(config)
      const data = res.data
      let match = {}

      if (data.workspaces) {
        // Match all items by name, since Postman API does not support filtering by name
        const matches = data.workspaces.filter(
          (o: { id?: string; name?: string; type?: string }) => {
            if (!o?.name) return
            return (
              o.name.toLowerCase().replace(/\s/g, '') ===
              workspaceName.toLowerCase().replace(/\s/g, '')
            )
          }
        )

        if (matches.length === 1) {
          match = matches[0]
        }
        if (matches.length > 1) {
          // Sort by date and take newest
          matches.sort((a, b) => {
            // Turn your strings into dates, and then subtract them
            // to get a value that is either negative, positive, or zero.

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <any>new Date(b.updatedAt) - <any>new Date(a.updatedAt)
          })
          console.log(
            `\nMultiple Postman workspaces matching "${workspaceName}", the most recent workspace is updated.`
          )
          match = matches[0]
        }
      }
      return match
    } catch (error) {
      console.log(error?.response?.data)
      return error.toString()
    }
  }

  isGuid(value: string | undefined): boolean {
    return /^\{?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}?$/.test(
      <string>value
    )
  }
}
