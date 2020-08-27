import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Unique,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne
} from "typeorm";
import { Length, IsNotEmpty, IsEmail } from "class-validator";
import * as bcrypt from "bcryptjs";
import { ExpiredAccessToken } from "./ExpiredAccessToken";

@Entity()
@Unique(["email"])
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    @IsEmail({}, { message: 'Nieprawidłowy format adresu E-mail' })
    @IsNotEmpty()
    email: string;

    @Column()
    @IsNotEmpty()
    @Length(2, 20, { message: 'Imię musi składać się z conajmniej dwóch znaków.' })
    username: string;

    @Column()
    @IsNotEmpty()
    @Length(2, 50, { message: 'Nazwisko musi składać się z conajmniej dwóch znaków.' })
    surname: string;

    @Column()
    @Length(4, 100, { message: 'Hasło musi składać się z conajmniej czterech znaków.' })
    password: string;

    @Column()
    @IsNotEmpty()
    role: string;

    @Column()
    activationCode: string;

    @Column()
    @CreateDateColumn()
    createdAt: Date;

    @Column()
    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(type => ExpiredAccessToken, expiredToken => expiredToken.user)
    expiredTokens: ExpiredAccessToken[];

    hashPassword() {
        this.password = bcrypt.hashSync(this.password, 8);
    }

    checkIfUnencryptedPasswordIsValid(unencryptedPassword: string) {
        return bcrypt.compareSync(unencryptedPassword, this.password);
    }

    makeActivationCode(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        result = bcrypt.hashSync(result);
        result = result.replace(/\//g, '');
        this.activationCode = result;
    }
}