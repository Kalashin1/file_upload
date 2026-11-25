import gql from 'graphql-tag'
import { Product, User } from './data'
import { ApolloServer } from '@apollo/server'
import { startStandaloneServer } from '@apollo/server/standalone'

export let Products: Product[] = [
    {
        id: 1,
        name: "Coca-cola",
        price: 500,
        slug: "coca-cola"
    },
    {
        id: 2,
        name: "Pepsi",
        price: 500,
        slug: "pepsi"
    },
    {
        id: 3,
        name: "Fanta",
        price: 500,
        slug: "fanta"
    },
    {
        id: 4,
        name: "Sprite",
        price: 500,
        slug: "sprite"
    }
]

export const users: User[] = [{
    name: "Jon Doe",
    id: 1,
    email: "jon@gmail.com",
    favorites: [1, 2]
}, {
    name: "Mary",
    id: 2,
    email: "mary@gmail.com",
    favorites: [3, 4]
}]

const typeDefs = gql`
type Product {
    id: ID!
    name: String!
    price: Int!
    slug: String!
}

type User {
    id: ID!
    name: String!
    email: String!
    favorites: [Product!]!
}

type Query {
    users: [User]!
    user(id: ID!): User!
    products: [Product]!
    product(id: ID!): Product!
}

type Mutation {
    addProduct(name: String!, price: Int!, slug: String!): Product!
    updateProduct(name: String!, price: Int!, slug: String!, id: Int!): Product!
    deleteProduct(id: ID!): Product!
}
`

const resolvers = {
    User: {
        favorites: (parent: User, _: any) => {
            return parent.favorites.map((id) => Products.find((p) => p.id === Number(id)))
        }
    },
    Query: {
        users: () => users,
        user: (_: any, args: { id: any }) => {
            const { id } = args;
            const user = users.find((u) => u.id === Number(id));
            if (!user) throw Error("No user with that ID")
            else return user
        },
        products: (_: any, __: any, ctx: any) => {
            return Products
        },
        product: (_: any, args: any) => {
            const id = args.id;
            const product = Products.find((product) => product.id === Number(id));
            if (!product) throw Error("No product with that ID")
            else return product
        }
    },
    Mutation: {
        addProduct: (_: any, args: Omit<Product, 'id'>) => {
            const { name, price, slug } = args;
            const product = { name, price, slug, id: Products.length + 1 };
            Products.push(product)
            return product
        },
        updateProduct: (_: any, args: Product) => {
            const { id, name, slug, price } = args;
            const product = Products.find((p) => p.id === Number(id))
            if (!product) throw Error("Product not found")
            else {
                product.name = name ?? product.name;
                product.price = price ?? product.price;
                product.slug = slug ?? product.slug;
                return product
            }
        },
        deleteProduct: (_: any, args: { id: number }) => {
            const { id } = args;
            const product = Products.find((p) => p.id === Number(id))
            if (!product) throw Error("No product with that ID")
            Products = Products.filter((p) => p.id !== product.id);
            return Products;
        }
    }
}

const main = async () => {

    const server = new ApolloServer({ typeDefs, resolvers })
    const { url } = await startStandaloneServer(server, {
        listen: { port: 3000 }
    })
    console.log(`server running on ${url}`)
}

main()
